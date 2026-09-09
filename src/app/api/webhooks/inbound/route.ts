import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { resolveCustomer } from "@/lib/customer-resolver";
import { chat, createNewConversation } from "@/lib/ai/engine";
import { emitNewMessage } from "@/lib/realtime";

interface InboundPayload {
  channel: string;
  channelDisplayName?: string;
  sender_name: string;
  sender_id: string;
  message: string;
  thread_id?: string;
  timestamp?: string;
  autoReply?: boolean;
  useAI?: boolean;
  metadata?: Record<string, unknown>;
}

function getWebhookSecret(): string {
  return process.env.INBOUND_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || "";
}

async function findOrCreateChannel(channelType: string, displayName?: string) {
  let channel = await prisma.channel.findUnique({
    where: { type: channelType },
  });

  if (!channel) {
    logger.info(`[Inbound] Auto-creating channel: ${channelType}`);
    channel = await prisma.channel.create({
      data: {
        type: channelType,
        displayName: displayName || channelType,
        isCustom: true,
        isActive: true,
        status: "connected",
      },
    });
  }

  return channel;
}

export async function POST(request: NextRequest) {
  try {
    // ─── Auth: validate X-Webhook-Secret ───────────────────
    const secret = getWebhookSecret();
    if (!secret) {
      logger.error("[Inbound] WEBHOOK_SECRET not configured");
      return NextResponse.json(
        { error: "Webhook secret not configured on server" },
        { status: 500 }
      );
    }

    const providedSecret = request.headers.get("x-webhook-secret");
    if (providedSecret !== secret) {
      logger.warn("[Inbound] Invalid webhook secret");
      return NextResponse.json(
        { error: "Invalid webhook secret" },
        { status: 401 }
      );
    }

    // ─── Parse payload ────────────────────────────────────
    const body: InboundPayload = await request.json();

    if (!body.channel || typeof body.channel !== "string") {
      return NextResponse.json(
        { error: "channel is required" },
        { status: 400 }
      );
    }
    if (!body.message || typeof body.message !== "string" || !body.message.trim()) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }
    if (!body.sender_id || typeof body.sender_id !== "string") {
      return NextResponse.json(
        { error: "sender_id is required" },
        { status: 400 }
      );
    }

    // ─── Find or auto-create channel ───────────────────────
    const channel = await findOrCreateChannel(body.channel, body.channelDisplayName);

    if (!channel.isActive) {
      logger.info(`[Inbound] Channel '${body.channel}' is disabled`);
      return NextResponse.json(
        {
          error: "Channel disabled",
          channel: body.channel,
          disabled: true,
          disabledReason: channel.disabledReason || "Channel has been disabled",
        },
        { status: 403 }
      );
    }

    // ─── Resolve customer ──────────────────────────────────
    const senderName = body.sender_name || "Unknown";
    const customerId = await resolveCustomer(body.channel, body.sender_id, senderName);

    // ─── Find or create conversation ───────────────────────
    let conversation = await prisma.conversation.findFirst({
      where: {
        channel: body.channel,
        status: { in: ["active", "escalated"] },
        OR: [
          { customerId },
          { customerContact: body.sender_id },
        ],
      },
    });

    if (!conversation) {
      conversation = await createNewConversation(
        body.channel,
        senderName,
        body.sender_id,
        customerId
      );
    }

    // ─── Store inbound message ──────────────────────────────
    const inboundMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "customer",
        content: body.message.trim(),
      },
    });

    emitNewMessage(conversation.id, {
      id: inboundMessage.id,
      role: "customer",
      content: body.message.trim(),
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        updatedAt: new Date(),
        ...(body.thread_id && {
          metadata: { ...(conversation.metadata as Record<string, unknown> || {}), threadId: body.thread_id },
        }),
      },
    });

    // ─── Determine auto-reply and AI settings ──────────────
    // Priority: payload > channel config > global setting
    const globalSettings = await prisma.settings.findFirst();
    const globalAutoReply = globalSettings?.autoReplyEnabled ?? true;

    const autoReply =
      typeof body.autoReply === "boolean"
        ? body.autoReply
        : channel.autoReplyEnabled
          ? true
          : globalAutoReply;

    const useAI =
      typeof body.useAI === "boolean"
        ? body.useAI
        : autoReply; // if useAI not specified, follow autoReply

    let autoReplied = false;
    let reply: string | null = null;

    if (useAI && autoReply) {
      try {
        reply = await chat(conversation.id, body.message.trim());

        // chat() already stores the assistant message and emits it
        autoReplied = true;
      } catch (error) {
        logger.error(`[Inbound] AI auto-reply failed for channel ${body.channel}:`, error);
      }
    }

    logger.info(
      `[Inbound] ${body.channel} from ${senderName} (${body.sender_id}) → conversation ${conversation.id}, autoReplied: ${autoReplied}`
    );

    return NextResponse.json({
      conversationId: conversation.id,
      channelId: channel.id,
      messageId: inboundMessage.id,
      autoReplied,
      reply,
    });
  } catch (error) {
    logger.error("[Inbound] Failed to process webhook:", error);
    return NextResponse.json(
      { error: "Failed to process inbound webhook" },
      { status: 500 }
    );
  }
}
