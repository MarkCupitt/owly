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

  const enrichedProposals = await Promise.all(
    proposals.map(async (p) => {
      const customer = await prisma.customer.findUnique({
        where: { id: p.customerId },
        select: { id: true, name: true, email: true, phone: true },
      });
      const proposedMatch = await prisma.customer.findUnique({
        where: { id: p.proposedMatchId },
        select: { id: true, name: true, email: true, phone: true },
      });
      return { ...p, customer, proposedMatch };
    })
  );

  return NextResponse.json({ proposals: enrichedProposals });
}
