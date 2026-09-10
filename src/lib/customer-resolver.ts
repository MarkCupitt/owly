import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isFakeEmail } from "@/lib/fake-email";

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
  externalId?: string;
  externalSystem?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Resolve a customer identity across channels using a multi-step matching strategy.
 *
 * Match priority:
 * 1. CustomerChannelLink (channel + externalId) — works for ANY channel
 * 2. Legacy channel-specific ID match (facebookId, instagramId, email, phone, whatsapp)
 * 3. External ID match (externalId + externalSystem on Customer)
 * 4. Email match (cross-channel, if senderEmail provided and not fake)
 * 5. Phone match (if senderPhone provided or channel is phone/whatsapp)
 * 6. Cross-field fallback (search all contact fields for customerContact)
 * 7. Auto-create new customer with all available identifiers + channel link
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
  const externalId = context?.externalId;
  const externalSystem = context?.externalSystem;
  const metadata = context?.metadata;
  const name = customerName || "Unknown";

  // Filter fake emails
  const validEmail = senderEmail && senderEmail.trim() && !(await isFakeEmail(senderEmail)) ? senderEmail.trim() : undefined;

  if (!customerContact && !validEmail && !senderPhone && !externalId) {
    return createCustomer(name, channel, customerContact, validEmail, senderPhone, externalId, externalSystem, metadata);
  }

  // Step 1: CustomerChannelLink match (channel-agnostic, works for ANY channel)
  if (customerContact) {
    const linkMatch = await prisma.customerChannelLink.findUnique({
      where: { channel_externalId: { channel, externalId: customerContact } },
      include: { customer: true },
    });
    if (linkMatch) {
      await updateExistingCustomer(linkMatch.customerId, channel, customerContact, name, validEmail, senderPhone, externalId, externalSystem, metadata);
      return linkMatch.customerId;
    }
  }

  // Step 2: Legacy channel-specific ID match
  const directMatch = await findByChannelField(channel, customerContact);
  if (directMatch) {
    await updateExistingCustomer(directMatch.id, channel, customerContact, name, validEmail, senderPhone, externalId, externalSystem, metadata);
    await ensureChannelLink(directMatch.id, channel, customerContact, metadata);
    return directMatch.id;
  }

  // Step 3: External ID match
  if (externalId && externalSystem) {
    const extMatch = await prisma.customer.findFirst({
      where: { externalId, externalSystem },
    });
    if (extMatch) {
      await updateExistingCustomer(extMatch.id, channel, customerContact, name, validEmail, senderPhone, externalId, externalSystem, metadata);
      await ensureChannelLink(extMatch.id, channel, customerContact, metadata);
      return extMatch.id;
    }
  }

  // Step 4: Email match (cross-channel) — only if not a fake email
  if (validEmail) {
    const emailMatch = await prisma.customer.findFirst({
      where: { email: { equals: validEmail, mode: "insensitive" } },
    });
    if (emailMatch) {
      await updateExistingCustomer(emailMatch.id, channel, customerContact, name, validEmail, senderPhone, externalId, externalSystem, metadata);
      await ensureChannelLink(emailMatch.id, channel, customerContact, metadata);
      return emailMatch.id;
    }
  }

  // Step 5: Phone match (cross-channel)
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
        await updateExistingCustomer(phoneMatch.id, channel, customerContact, name, validEmail, senderPhone, externalId, externalSystem, metadata);
        await ensureChannelLink(phoneMatch.id, channel, customerContact, metadata);
        return phoneMatch.id;
      }
    }
  }

  // Step 5b: Normalized phone match (for phone/whatsapp channels using customerContact)
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
        await updateExistingCustomer(phoneMatch.id, channel, customerContact, name, validEmail, senderPhone, externalId, externalSystem, metadata);
        await ensureChannelLink(phoneMatch.id, channel, customerContact, metadata);
        return phoneMatch.id;
      }
    }
  }

  // Step 6: Cross-field fallback (search all contact fields for customerContact)
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
      await updateExistingCustomer(crossMatch.id, channel, customerContact, name, validEmail, senderPhone, externalId, externalSystem, metadata);
      await ensureChannelLink(crossMatch.id, channel, customerContact, metadata);
      return crossMatch.id;
    }
  }

  // Step 7: Auto-create new customer with all available identifiers + channel link
  return createCustomer(name, channel, customerContact, validEmail, senderPhone, externalId, externalSystem, metadata);
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

async function ensureChannelLink(
  customerId: string,
  channel: string,
  externalId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (!channel || !externalId) return;
  try {
    await prisma.customerChannelLink.upsert({
      where: { channel_externalId: { channel, externalId } },
      create: { customerId, channel, externalId, metadata: (metadata || {}) as any },
      update: {},
    });
  } catch (err) {
    logger.error("Failed to ensure channel link", { customerId, channel, externalId, error: err });
  }
}

async function createCustomer(
  name: string,
  channel: string,
  contact: string,
  senderEmail?: string,
  senderPhone?: string,
  externalId?: string,
  externalSystem?: string,
  metadata?: Record<string, unknown>
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
  if (externalId) data.externalId = externalId;
  if (externalSystem) data.externalSystem = externalSystem;

  try {
    const customer = await prisma.customer.create({ data: data as any });

    // Create channel link
    if (contact && channel) {
      await prisma.customerChannelLink.create({
        data: { customerId: customer.id, channel, externalId: contact, metadata: (metadata || {}) as any },
      }).catch((err) => {
        logger.error("Failed to create channel link on new customer", { customerId: customer.id, channel, error: err });
      });
    }

    logger.info("Auto-created customer from channel contact", {
      customerId: customer.id,
      channel,
      email: senderEmail ? "(from context)" : undefined,
    });

    return customer.id;
  } catch (err: any) {
    // Race condition: concurrent create for same customer
    if (err?.code === "P2002") {
      logger.warn("Race condition in createCustomer, falling back to find", { channel, contact });
      if (senderEmail) {
        const existing = await prisma.customer.findFirst({
          where: { email: { equals: senderEmail, mode: "insensitive" } },
        });
        if (existing) return existing.id;
      }
      const existingByChannel = await findByChannelField(channel, contact);
      if (existingByChannel) return existingByChannel.id;
    }
    throw err;
  }
}

async function updateExistingCustomer(
  customerId: string,
  channel: string,
  contact: string,
  name: string,
  senderEmail?: string,
  senderPhone?: string,
  externalId?: string,
  externalSystem?: string,
  metadata?: Record<string, unknown>
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
      externalId: true,
      externalSystem: true,
      profilePicUrl: true,
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

  // Backfill external ID
  if (externalId && !customer.externalId) update.externalId = externalId;
  if (externalSystem && !customer.externalSystem) update.externalSystem = externalSystem;

  // Update name if current is "Unknown" and we have a better one
  if (customer.name === "Unknown" && name && name !== "Unknown") {
    update.name = name;
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: update,
  });
}
