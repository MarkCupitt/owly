import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/route-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const externalId = searchParams.get("externalId");
  const externalSystem = searchParams.get("externalSystem");
  const email = searchParams.get("email");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

  if (!externalId && !email) {
    return NextResponse.json(
      { error: "externalId or email is required" },
      { status: 400 }
    );
  }

  let customer = null;

  if (externalId && externalSystem) {
    customer = await prisma.customer.findFirst({
      where: { externalId, externalSystem },
    });
  }

  if (!customer && email) {
    customer = await prisma.customer.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
  }

  if (!customer) {
    return NextResponse.json({ conversations: [], total: 0 });
  }

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where: { customerId: customer.id },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        channel: true,
        status: true,
        customerName: true,
        summary: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    }),
    prisma.conversation.count({ where: { customerId: customer.id } }),
  ]);

  return NextResponse.json({
    conversations: conversations.map((c) => ({
      ...c,
      messageCount: c._count.messages,
      _count: undefined,
    })),
    total,
    page,
    limit,
  });
}
