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
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
      proposedMatch: { select: { id: true, name: true, email: true, phone: true } },
    },
  });

  // Filter out stale proposals where either customer was deleted
  const validProposals = proposals.filter(
    (p) => p.customer !== null && p.proposedMatch !== null
  );

  // Clean up stale proposals in the background
  if (validProposals.length < proposals.length) {
    const staleIds = proposals
      .filter((p) => p.customer === null || p.proposedMatch === null)
      .map((p) => p.id);
    prisma.customerMatchProposal.deleteMany({
      where: { id: { in: staleIds } },
    }).catch(() => {});
  }

  return NextResponse.json({ proposals: validProposals });
}
