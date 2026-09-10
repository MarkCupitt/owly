import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/route-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const action = body.action as "approve" | "reject";

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  const proposal = await prisma.customerMatchProposal.findUnique({ where: { id } });
  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  const resolvedBy = "userId" in auth ? auth.userId : "system";

  if (action === "reject") {
    await prisma.customerMatchProposal.update({
      where: { id },
      data: { status: "rejected", resolvedAt: new Date(), resolvedBy },
    });
    return NextResponse.json({ success: true, action: "rejected" });
  }

  // Approve: merge source customer into target
  const sourceId = proposal.customerId;
  const targetId = proposal.proposedMatchId;

  const [source, target] = await Promise.all([
    prisma.customer.findUnique({ where: { id: sourceId } }),
    prisma.customer.findUnique({ where: { id: targetId } }),
  ]);

  if (!source || !target) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  await prisma.$transaction([
    // Move conversations
    prisma.conversation.updateMany({
      where: { customerId: sourceId },
      data: { customerId: targetId },
    }),
    // Move channel links
    prisma.customerChannelLink.updateMany({
      where: { customerId: sourceId },
      data: { customerId: targetId },
    }),
    // Move notes
    prisma.customerNote.updateMany({
      where: { customerId: sourceId },
      data: { customerId: targetId },
    }),
    // Backfill target fields from source
    prisma.customer.update({
      where: { id: targetId },
      data: {
        email: target.email || source.email || "",
        phone: target.phone || source.phone || "",
        whatsapp: target.whatsapp || source.whatsapp || "",
        facebookId: target.facebookId || source.facebookId || "",
        instagramId: target.instagramId || source.instagramId || "",
        externalId: target.externalId || source.externalId || "",
        externalSystem: target.externalSystem || source.externalSystem || "",
        profilePicUrl: target.profilePicUrl || source.profilePicUrl || "",
      },
    }),
    // Delete source customer
    prisma.customer.delete({ where: { id: sourceId } }),
    // Mark proposal as approved
    prisma.customerMatchProposal.update({
      where: { id },
      data: { status: "approved", resolvedAt: new Date(), resolvedBy },
    }),
  ]);

  return NextResponse.json({ success: true, action: "approved", mergedInto: targetId });
}
