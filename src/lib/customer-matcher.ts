import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface MatchCandidate {
  id: string;
  name: string;
  email: string;
  matchType: string;
  confidence: string;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export async function findNameMatches(name: string, excludeId: string): Promise<MatchCandidate[]> {
  if (!name || name === "Unknown") return [];

  const normalized = normalizeName(name);
  if (normalized.length < 3) return [];

  const customers = await prisma.customer.findMany({
    where: {
      id: { not: excludeId },
      name: { not: "Unknown" },
    },
    select: { id: true, name: true, email: true },
    take: 500,
  });

  const matches: MatchCandidate[] = [];

  for (const c of customers) {
    const cNormalized = normalizeName(c.name);
    if (!cNormalized) continue;

    if (cNormalized === normalized) {
      matches.push({ id: c.id, name: c.name, email: c.email, matchType: "name_exact", confidence: "high" });
    } else {
      const distance = levenshtein(normalized, cNormalized);
      const maxLen = Math.max(normalized.length, cNormalized.length);
      if (distance <= 2 && maxLen >= 4) {
        matches.push({ id: c.id, name: c.name, email: c.email, matchType: "name_fuzzy", confidence: "medium" });
      }
    }
  }

  return matches;
}

export async function createMatchProposal(
  customerId: string,
  matchId: string,
  matchType: string,
  confidence: string
): Promise<void> {
  try {
    await prisma.customerMatchProposal.create({
      data: { customerId, proposedMatchId: matchId, matchType, confidence },
    });
  } catch (err) {
    logger.error("Failed to create match proposal", { customerId, matchId, error: err });
  }
}

export async function checkAndProposeMatches(customerId: string, name: string): Promise<void> {
  const matches = await findNameMatches(name, customerId);
  for (const match of matches) {
    await createMatchProposal(customerId, match.id, match.matchType, match.confidence);
  }
}
