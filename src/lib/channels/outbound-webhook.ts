import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface OutboundPayload {
  channel: string;
  channel_display_name: string;
  conversation_id: string;
  recipient_id: string;
  recipient_name: string;
  message_text: string;
  thread_id?: string;
  timestamp: string;
  customer_email?: string;
  customer_phone?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fire outbound webhook to an external system when staff reply
 * on a custom channel conversation.
 *
 * This is called after a staff member sends a reply (or a canned response)
 * via the Owly dashboard. Human-initiated replies ALWAYS fire — they are
 * not gated by auto-reply or AI settings.
 */
export async function fireOutboundWebhook(
  conversationId: string,
  messageContent: string
): Promise<void> {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      logger.warn(`[Outbound] Conversation ${conversationId} not found`);
      return;
    }

    const channel = await prisma.channel.findUnique({
      where: { type: conversation.channel },
    });

    if (!channel) {
      logger.warn(`[Outbound] Channel '${conversation.channel}' not found, skipping outbound webhook`);
      return;
    }

    // Only fire for custom channels with an outbound webhook URL configured
    if (!channel.isCustom || !channel.outboundWebhookUrl) {
      return;
    }

    // Don't fire for disabled channels
    if (!channel.isActive) {
      logger.info(`[Outbound] Channel '${channel.type}' is disabled, skipping outbound webhook`);
      return;
    }

    const metadata = (conversation.metadata as Record<string, unknown>) || {};
    const threadId = (metadata.threadId as string) || undefined;

    // Fetch customer for email/phone enrichment
    let customerEmail: string | undefined;
    let customerPhone: string | undefined;
    if (conversation.customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: conversation.customerId },
        select: { email: true, phone: true },
      });
      if (customer) {
        customerEmail = customer.email || undefined;
        customerPhone = customer.phone || undefined;
      }
    }

    const payload: OutboundPayload = {
      channel: channel.type,
      channel_display_name: channel.displayName || channel.type,
      conversation_id: conversationId,
      recipient_id: conversation.customerContact,
      recipient_name: conversation.customerName,
      message_text: messageContent,
      thread_id: threadId,
      timestamp: new Date().toISOString(),
      customer_email: customerEmail,
      customer_phone: customerPhone,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };

    // Build headers from channel config + default content-type
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const customHeaders = channel.outboundWebhookHeaders as Record<string, string>;
    if (customHeaders && typeof customHeaders === "object") {
      for (const [key, value] of Object.entries(customHeaders)) {
        headers[key] = value;
      }
    }

    // Fire and forget — don't block the API response
    const response = await fetch(channel.outboundWebhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      logger.error(
        `[Outbound] Webhook to ${channel.outboundWebhookUrl} returned ${response.status} ${response.statusText}`
      );
    } else {
      logger.info(
        `[Outbound] Reply delivered to channel '${channel.type}' for conversation ${conversationId}`
      );
    }
  } catch (error) {
    logger.error(`[Outbound] Failed to fire webhook for conversation ${conversationId}:`, error);
  }
}
