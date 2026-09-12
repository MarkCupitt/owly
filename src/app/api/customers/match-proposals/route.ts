import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/route-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const proposals = await prisma.customerMatchProposal.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
  });

  if (proposals.length === 0) {
    return NextResponse.json({ proposals: [] });
  }

  // Batch-fetch all related customers to avoid N+1 queries
  const customerIds = new Set<string>();
  for (const p of proposals) {
    customerIds.add(p.customerId);
    customerIds.add(p.proposedMatchId);
  }
  const customers = await prisma.customer.findMany({
    where: { id: { in: [...customerIds] } },
    select: { id: true, name: true, email: true, phone: true },
  });
  const customerMap = new Map(customers.map((c) => [c.id, c]));

  const enrichedProposals = proposals.map((p) => ({
    ...p,
    customer: customerMap.get(p.customerId) ?? null,
    proposedMatch: customerMap.get(p.proposedMatchId) ?? null,
  }));

  // Filter out stale proposals where either customer was deleted
  const validProposals = enrichedProposals.filter(
    (p) => p.customer !== null && p.proposedMatch !== null
  );

  // Clean up stale proposals in the background
  if (validProposals.length < enrichedProposals.length) {
    const staleIds = enrichedProposals
      .filter((p) => p.customer === null || p.proposedMatch === null)
      .map((p) => p.id);
    prisma.customerMatchProposal.deleteMany({
      where: { id: { in: staleIds } },
    }).catch(() => {});
  }

  return NextResponse.json({ proposals: validProposals });
}
