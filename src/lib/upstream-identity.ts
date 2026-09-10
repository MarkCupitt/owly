import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface UpstreamUser {
  userId: string;
  displayName: string;
  firstName: string;
  lastName: string;
  photoUrl: string;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((acc: unknown, key: string) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export async function lookupUpstreamUser(email: string): Promise<UpstreamUser | null> {
  const settings = await prisma.settings.findFirst();
  if (!settings?.upstreamIdentityEnabled || !settings?.upstreamIdentityUrl) {
    return null;
  }

  const url = settings.upstreamIdentityUrl.replace("{email}", encodeURIComponent(email));
  const headerName = settings.upstreamIdentityApiKeyHeader || "Authorization";
  const prefix = settings.upstreamIdentityApiKeyPrefix || "Bearer ";
  const apiKey = settings.upstreamIdentityApiKey;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers[headerName] = prefix + apiKey;
  }

  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      logger.error("Upstream identity lookup failed", { status: response.status, email });
      throw new Error(`Upstream lookup failed: ${response.status}`);
    }

    const data = await response.json() as Record<string, unknown>;

    return {
      userId: String(getNestedValue(data, settings.upstreamIdentityResponseUserIdField || "user_id") || ""),
      displayName: String(getNestedValue(data, settings.upstreamIdentityResponseNameField || "display_name") || ""),
      firstName: String(getNestedValue(data, settings.upstreamIdentityResponseFirstNameField || "first_name") || ""),
      lastName: String(getNestedValue(data, settings.upstreamIdentityResponseLastNameField || "last_name") || ""),
      photoUrl: String(getNestedValue(data, settings.upstreamIdentityResponsePhotoField || "photo_url") || ""),
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes("Upstream lookup failed")) {
      throw err;
    }
    logger.error("Upstream identity lookup error", { email, error: err });
    throw err;
  }
}

export async function linkUpstreamIdentity(
  customerId: string,
  email: string
): Promise<{ found: boolean; user?: UpstreamUser }> {
  const settings = await prisma.settings.findFirst();
  if (!settings?.upstreamIdentityEnabled) {
    return { found: false };
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { externalId: true, name: true },
  });

  if (!customer || customer.externalId) {
    return { found: false };
  }

  const user = await lookupUpstreamUser(email);
  if (!user || !user.userId) {
    return { found: false };
  }

  const update: Record<string, unknown> = {
    externalId: user.userId,
    externalSystem: settings.upstreamIdentitySystemLabel || "upstream",
  };

  if (user.photoUrl) update.profilePicUrl = user.photoUrl;
  if (customer.name === "Unknown" && user.displayName) update.name = user.displayName;

  await prisma.customer.update({
    where: { id: customerId },
    data: update,
  });

  logger.info("Linked upstream identity", { customerId, externalId: user.userId, system: settings.upstreamIdentitySystemLabel });

  return { found: true, user };
}
