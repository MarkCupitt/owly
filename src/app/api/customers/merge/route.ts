import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/route-auth";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const body = await request.json();
  const { sourceId, targetId } = body;

  if (!sourceId || !targetId) {
    return NextResponse.json({ error: "sourceId and targetId are required" }, { status: 400 });
  }

  if (sourceId === targetId) {
    return NextResponse.json({ error: "Cannot merge a customer with themselves" }, { status: 400 });
  }

  const [source, target] = await Promise.all([
    prisma.customer.findUnique({ where: { id: sourceId } }),
    prisma.customer.findUnique({ where: { id: targetId } }),
  ]);

  if (!source || !target) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.conversation.updateMany({
      where: { customerId: sourceId },
      data: { customerId: targetId },
    }),
    prisma.customerChannelLink.updateMany({
      where: { customerId: sourceId },
      data: { customerId: targetId },
    }),
    prisma.customerNote.updateMany({
      where: { customerId: sourceId },
      data: { customerId: targetId },
    }),
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
    prisma.customer.delete({ where: { id: sourceId } }),
  ]);

  return NextResponse.json({ success: true, mergedInto: targetId });
}
