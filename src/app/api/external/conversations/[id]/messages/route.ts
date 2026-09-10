import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/route-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { id } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    select: {
      id: true,
      customerId: true,
      channel: true,
      status: true,
      customerName: true,
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const externalId = searchParams.get("externalId");
  const externalSystem = searchParams.get("externalSystem");
  const email = searchParams.get("email");

  if (externalId && externalSystem) {
    const customer = await prisma.customer.findFirst({
      where: { externalId, externalSystem },
      select: { id: true },
    });
    if (!customer || customer.id !== conversation.customerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (email) {
    const customer = await prisma.customer.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (!customer || customer.id !== conversation.customerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      content: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ messages });
}
