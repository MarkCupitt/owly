import { prisma } from "@/lib/prisma";

let cachedDomains: string[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 60000; // 1 minute

async function getFakeDomains(): Promise<string[]> {
  if (cachedDomains && Date.now() - cacheTime < CACHE_TTL) {
    return cachedDomains;
  }
  try {
    const settings = await prisma.settings.findFirst();
    const domains = (settings?.fakeEmailDomains || "facebook.com")
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    cachedDomains = domains;
    cacheTime = Date.now();
    return domains;
  } catch {
    return ["facebook.com"];
  }
}

export function isFakeEmailSync(email: string, fakeDomains: string[]): boolean {
  if (!email || !email.includes("@")) return false;
  const domain = email.split("@")[1]?.toLowerCase().trim();
  return fakeDomains.includes(domain);
}

export async function isFakeEmail(email: string): Promise<boolean> {
  const domains = await getFakeDomains();
  return isFakeEmailSync(email, domains);
}

export function extractEmail(text: string): string | null {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : null;
}
