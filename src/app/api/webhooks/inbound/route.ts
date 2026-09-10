import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { resolveCustomer } from "@/lib/customer-resolver";
import { chat, createNewConversation } from "@/lib/ai/engine";
import { emitNewMessage } from "@/lib/realtime";
import { fireOutboundWebhook } from "@/lib/channels/outbound-webhook";
import { evaluateRules } from "@/lib/automation";
import { createNotification } from "@/lib/notifications";
import { linkUpstreamIdentity } from "@/lib/upstream-identity";
import { isFakeEmailSync, extractEmail } from "@/lib/fake-email";
import { checkAndProposeMatches } from "@/lib/customer-matcher";

interface InboundPayload {
  channel: string;
  channelDisplayName?: string;
  sender_name: string;
  sender_id: string;
  sender_email?: string;
  sender_phone?: string;
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
    try {
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
    } catch (e: any) {
      if (e.code === "P2002") {
        channel = await prisma.channel.findUnique({
          where: { type: channelType },
        });
      } else {
        throw e;
      }
    }
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

    if (!channel) {
      logger.error(`[Inbound] Failed to find or create channel: ${body.channel}`);
      return NextResponse.json(
        { error: "Failed to find or create channel" },
        { status: 500 }
      );
    }

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
    const senderPhone = (body.metadata?.phone as string) || body.sender_phone;
    const customerId = await resolveCustomer(body.channel, body.sender_id, senderName, {
      senderEmail: body.sender_email,
      senderPhone,
      metadata: body.metadata,
    });

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

    // ─── Email detection + upstream identity ─────────────
    const detectedEmail = extractEmail(body.message);
    if (detectedEmail && !isFakeEmailSync(detectedEmail, ["facebook.com"])) {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { email: true, externalId: true },
      });
      if (customer && (!customer.email || isFakeEmailSync(customer.email, ["facebook.com"]))) {
        await prisma.customer.update({
          where: { id: customerId },
          data: { email: detectedEmail },
        });
        if (!customer.externalId) {
          linkUpstreamIdentity(customerId, detectedEmail).catch((err) =>
            logger.error("[Inbound] Upstream identity lookup failed:", err)
          );
        }
      }
    }

    // ─── Name-based match proposals ──────────────────────
    checkAndProposeMatches(customerId, senderName).catch((err) =>
      logger.error("[Inbound] Match proposal check failed:", err)
    );

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

    // ─── Evaluate automation rules (for non-AI path) ─────
    if (!useAI || !autoReply) {
      try {
        const matchedActions = await evaluateRules(
          { content: body.message, channel: body.channel, customerName: senderName },
          { id: conversation.id, channel: body.channel, customerName: senderName }
        );
        for (const action of matchedActions) {
          if (action.type === "keyword_alert") {
            await createNotification({
              type: "automation",
              title: `Keyword Alert: ${action.ruleName}`,
              message: `Triggered by message: "${body.message.substring(0, 100)}"`,
              entityId: conversation.id,
              entityType: "conversation",
              metadata: { ruleId: action.ruleId, actions: action.actions },
            });
          }
        }
      } catch (err) {
        logger.error("[Inbound] Automation rule evaluation failed:", err);
      }
    }

    let autoReplied = false;
    let reply: string | null = null;

    if (useAI && autoReply) {
      try {
        reply = await chat(conversation.id, body.message.trim());

        // chat() already stores the assistant message and emits it
        autoReplied = true;

        // Fire outbound webhook so the AI reply gets delivered back to the channel
        if (reply) {
          fireOutboundWebhook(conversation.id, reply).catch((err) =>
            logger.error("[Inbound] Outbound webhook for AI reply failed:", err)
          );
        }
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
