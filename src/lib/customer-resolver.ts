import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Normalize a phone number for consistent matching.
 * Strips WhatsApp suffixes (@c.us, @s.whatsapp.net) and non-digit chars (except leading +).
 */
export function normalizePhone(input: string): string {
  const cleaned = input.replace(/@(c\.us|s\.whatsapp\.net)$/, "");
  return cleaned.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
}

export interface CustomerMatchContext {
  channel: string;
  customerContact: string;
  customerName: string;
  senderEmail?: string;
  senderPhone?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Resolve a customer identity across channels using a multi-step matching strategy.
 *
 * Match priority:
 * 1. Channel-specific ID match (facebookId, instagramId, email, phone, whatsapp)
 * 2. Email match (cross-channel, if senderEmail provided)
 * 3. Phone match (if senderPhone provided or channel is phone/whatsapp)
 * 4. Cross-field fallback (search all contact fields for customerContact)
 * 5. Auto-create new customer with all available identifiers backfilled
 *
 * Returns the customerId for linking to conversations.
 */
export async function resolveCustomer(
  channel: string,
  customerContact: string,
  customerName: string,
  context?: Partial<CustomerMatchContext>
): Promise<string> {
  const senderEmail = context?.senderEmail;
  const senderPhone = context?.senderPhone;
  const name = customerName || "Unknown";

  if (!customerContact && !senderEmail && !senderPhone) {
    return createCustomer(name, channel, customerContact, senderEmail, senderPhone);
  }

  // Step 1: Channel-specific ID match
  const directMatch = await findByChannelField(channel, customerContact);
  if (directMatch) {
    await updateExistingCustomer(directMatch.id, channel, customerContact, name, senderEmail, senderPhone);
    return directMatch.id;
  }

  // Step 2: Email match (cross-channel)
  if (senderEmail && senderEmail.trim()) {
    const emailMatch = await prisma.customer.findFirst({
      where: { email: { equals: senderEmail, mode: "insensitive" } },
    });
    if (emailMatch) {
      await updateExistingCustomer(emailMatch.id, channel, customerContact, name, senderEmail, senderPhone);
      return emailMatch.id;
    }
  }

  // Step 3: Phone match (cross-channel)
  if (senderPhone && senderPhone.trim()) {
    const normalized = normalizePhone(senderPhone);
    if (normalized.length >= 7) {
      const phoneMatch = await prisma.customer.findFirst({
        where: {
          OR: [
            { phone: { contains: normalized } },
            { whatsapp: { contains: normalized } },
          ],
        },
      });
      if (phoneMatch) {
        await updateExistingCustomer(phoneMatch.id, channel, customerContact, name, senderEmail, senderPhone);
        return phoneMatch.id;
      }
    }
  }

  // Step 3b: Normalized phone match (for phone/whatsapp channels using customerContact)
  if (channel === "phone" || channel === "whatsapp") {
    const normalized = normalizePhone(customerContact);
    if (normalized.length >= 7) {
      const phoneMatch = await prisma.customer.findFirst({
        where: {
          OR: [
            { phone: { contains: normalized } },
            { whatsapp: { contains: normalized } },
          ],
        },
      });
      if (phoneMatch) {
        await updateExistingCustomer(phoneMatch.id, channel, customerContact, name, senderEmail, senderPhone);
        return phoneMatch.id;
      }
    }
  }

  // Step 4: Cross-field fallback (search all contact fields for customerContact)
  if (customerContact) {
    const crossMatch = await prisma.customer.findFirst({
      where: {
        OR: [
          { email: { equals: customerContact, mode: "insensitive" } },
          { phone: customerContact },
          { whatsapp: customerContact },
          { facebookId: customerContact },
          { instagramId: customerContact },
        ],
      },
    });
    if (crossMatch) {
      await updateExistingCustomer(crossMatch.id, channel, customerContact, name, senderEmail, senderPhone);
      return crossMatch.id;
    }
  }

  // Step 5: Auto-create new customer with all available identifiers
  return createCustomer(name, channel, customerContact, senderEmail, senderPhone);
}

async function findByChannelField(channel: string, contact: string) {
  if (!contact) return null;
  switch (channel) {
    case "email":
      return prisma.customer.findFirst({
        where: { email: { equals: contact, mode: "insensitive" } },
      });
    case "whatsapp":
      return prisma.customer.findFirst({
        where: { whatsapp: contact },
      });
    case "phone":
      return prisma.customer.findFirst({
        where: { phone: contact },
      });
    case "messenger":
      return prisma.customer.findFirst({
        where: { facebookId: contact },
      });
    case "instagram":
      return prisma.customer.findFirst({
        where: { instagramId: contact },
      });
    default:
      return null;
  }
}

async function createCustomer(
  name: string,
  channel: string,
  contact: string,
  senderEmail?: string,
  senderPhone?: string
): Promise<string> {
  const data: Record<string, unknown> = {
    name: name || "Unknown",
    firstContact: new Date(),
    lastContact: new Date(),
  };

  // Channel-specific contact field
  if (channel === "email" && contact) data.email = contact;
  if (channel === "whatsapp" && contact) data.whatsapp = contact;
  if (channel === "phone" && contact) data.phone = contact;
  if (channel === "messenger" && contact) data.facebookId = contact;
  if (channel === "instagram" && contact) data.instagramId = contact;

  // Additional identifiers from context
  if (senderEmail && senderEmail.trim()) data.email = senderEmail;
  if (senderPhone && senderPhone.trim()) {
    const normalized = normalizePhone(senderPhone);
    if (normalized.length >= 7) data.phone = normalized;
  }

  const customer = await prisma.customer.create({ data: data as any });

  logger.info("Auto-created customer from channel contact", {
    customerId: customer.id,
    channel,
    email: senderEmail ? "(from context)" : undefined,
  });

  return customer.id;
}

async function updateExistingCustomer(
  customerId: string,
  channel: string,
  contact: string,
  name: string,
  senderEmail?: string,
  senderPhone?: string
): Promise<void> {
  const update: Record<string, unknown> = {
    lastContact: new Date(),
  };

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      name: true,
      email: true,
      phone: true,
      whatsapp: true,
      facebookId: true,
      instagramId: true,
    },
  });

  if (!customer) return;

  // Backfill channel-specific contact field
  if (channel === "email" && contact && !customer.email) update.email = contact;
  if (channel === "whatsapp" && contact && !customer.whatsapp) update.whatsapp = contact;
  if (channel === "phone" && contact && !customer.phone) update.phone = contact;
  if (channel === "messenger" && contact && !customer.facebookId) update.facebookId = contact;
  if (channel === "instagram" && contact && !customer.instagramId) update.instagramId = contact;

  // Backfill email from context
  if (senderEmail && senderEmail.trim() && !customer.email) {
    update.email = senderEmail;
  }

  // Backfill phone from context
  if (senderPhone && senderPhone.trim()) {
    const normalized = normalizePhone(senderPhone);
    if (normalized.length >= 7 && !customer.phone) {
      update.phone = normalized;
    }
  }

  // Update name if current is "Unknown" and we have a better one
  if (customer.name === "Unknown" && name && name !== "Unknown") {
    update.name = name;
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: update,
  });
}
