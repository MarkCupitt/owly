import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe("Outbound Webhook", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockFetch.mockReset();

    (prisma.conversation.findUnique as ReturnType<typeof vi.fn>).mockReset();
    (prisma.channel.findUnique as ReturnType<typeof vi.fn>).mockReset();
  });

  it("should fire webhook when staff reply on a custom channel", async () => {
    const { fireOutboundWebhook } = await import("@/lib/channels/outbound-webhook");
    (prisma.conversation.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "conv-1",
      channel: "messenger",
      customerName: "John Smith",
      customerContact: "fb_123",
      metadata: { threadId: "msg_abc" },
    });
    (prisma.channel.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ch-1",
      type: "messenger",
      isActive: true,
      isCustom: true,
      outboundWebhookUrl: "https://n8n.example.com/webhook/reply",
      outboundWebhookHeaders: { "X-Custom": "value" },
    });
    mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: "OK" });

    await fireOutboundWebhook("conv-1", "Here is your reply");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://n8n.example.com/webhook/reply",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Custom": "value",
        }),
      })
    );
    const callArgs = mockFetch.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(callArgs.body as string);
    expect(body.channel).toBe("messenger");
    expect(body.recipient_id).toBe("fb_123");
    expect(body.recipient_name).toBe("John Smith");
    expect(body.message_text).toBe("Here is your reply");
    expect(body.thread_id).toBe("msg_abc");
  });

  it("should NOT fire webhook for built-in channels", async () => {
    const { fireOutboundWebhook } = await import("@/lib/channels/outbound-webhook");
    (prisma.conversation.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "conv-1",
      channel: "whatsapp",
      customerName: "John",
      customerContact: "+123",
      metadata: {},
    });
    (prisma.channel.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ch-1",
      type: "whatsapp",
      isActive: true,
      isCustom: false,
      outboundWebhookUrl: "",
      outboundWebhookHeaders: {},
    });

    await fireOutboundWebhook("conv-1", "Reply text");

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should NOT fire webhook when channel is disabled", async () => {
    const { fireOutboundWebhook } = await import("@/lib/channels/outbound-webhook");
    (prisma.conversation.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "conv-1",
      channel: "messenger",
      customerName: "John",
      customerContact: "fb_123",
      metadata: {},
    });
    (prisma.channel.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ch-1",
      type: "messenger",
      isActive: false,
      isCustom: true,
      outboundWebhookUrl: "https://n8n.example.com/webhook/reply",
      outboundWebhookHeaders: {},
    });

    await fireOutboundWebhook("conv-1", "Reply text");

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should NOT fire webhook when outboundWebhookUrl is empty", async () => {
    const { fireOutboundWebhook } = await import("@/lib/channels/outbound-webhook");
    (prisma.conversation.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "conv-1",
      channel: "messenger",
      customerName: "John",
      customerContact: "fb_123",
      metadata: {},
    });
    (prisma.channel.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ch-1",
      type: "messenger",
      isActive: true,
      isCustom: true,
      outboundWebhookUrl: "",
      outboundWebhookHeaders: {},
    });

    await fireOutboundWebhook("conv-1", "Reply text");

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should handle conversation not found gracefully", async () => {
    const { fireOutboundWebhook } = await import("@/lib/channels/outbound-webhook");
    (prisma.conversation.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await fireOutboundWebhook("nonexistent", "Reply text");

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should handle channel not found gracefully", async () => {
    const { fireOutboundWebhook } = await import("@/lib/channels/outbound-webhook");
    (prisma.conversation.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "conv-1",
      channel: "unknown_channel",
      customerName: "John",
      customerContact: "123",
      metadata: {},
    });
    (prisma.channel.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await fireOutboundWebhook("conv-1", "Reply text");

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
