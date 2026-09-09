import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createRequest, parseJsonResponse } from "../helpers/request";

// Mock customer-resolver
vi.mock("@/lib/customer-resolver", () => ({
  resolveCustomer: vi.fn().mockResolvedValue("cust-1"),
}));

// Mock AI engine
vi.mock("@/lib/ai/engine", () => ({
  chat: vi.fn().mockResolvedValue("AI auto-reply text"),
  createNewConversation: vi.fn().mockImplementation(
    async (channel: string, customerName: string, customerContact: string) => ({
      id: "conv-e2e",
      channel,
      customerName,
      customerContact,
    })
  ),
}));

// Mock fetch for outbound webhook
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe("E2E: Inbound → Auto-Reply → Staff Reply → Outbound Webhook", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.INBOUND_WEBHOOK_SECRET = "e2e-secret";
    mockFetch.mockReset();

    // Reset all prisma mocks
    for (const model of Object.keys(prisma)) {
      if (typeof prisma[model] === "object" && prisma[model] !== null) {
        for (const method of Object.keys(prisma[model] as Record<string, unknown>)) {
          if (typeof (prisma[model] as Record<string, ReturnType<typeof vi.fn>>)[method]?.mockReset === "function") {
            (prisma[model] as Record<string, ReturnType<typeof vi.fn>>)[method].mockReset();
          }
        }
      }
    }

    // Default mocks
    (prisma.message.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "msg-1",
      conversationId: "conv-e2e",
      role: "customer",
      content: "test",
    });
    (prisma.conversation.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.settings.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      autoReplyEnabled: true,
    });
  });

  it("full flow: n8n sends message → Owly auto-creates channel → AI replies → staff replies → outbound webhook fires", async () => {
    // ─── Step 1: n8n sends inbound message ───────────────────────────
    const { POST: inboundPOST } = await import("@/app/api/webhooks/inbound/route");

    // Channel doesn't exist yet → auto-create
    (prisma.channel.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.channel.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ch-messenger",
      type: "messenger",
      isActive: true,
      isCustom: true,
      displayName: "Facebook Messenger",
      outboundWebhookUrl: "https://n8n.example.com/webhook/messenger-reply",
      outboundWebhookHeaders: {},
      autoReplyEnabled: true,
      status: "connected",
      disabledReason: "",
    });
    (prisma.conversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const inboundRequest = createRequest("/api/webhooks/inbound", {
      method: "POST",
      headers: { "x-webhook-secret": "e2e-secret" },
      body: {
        channel: "messenger",
        channelDisplayName: "Facebook Messenger",
        sender_name: "Jane Doe",
        sender_id: "fb_jane_123",
        message: "I need help with my order #42",
        thread_id: "msg_thread_abc",
        autoReply: true,
      },
    });

    const inboundResponse = await inboundPOST(inboundRequest);
    expect(inboundResponse.status).toBe(200);
    const inboundData = await parseJsonResponse(inboundResponse);
    expect(inboundData.conversationId).toBe("conv-e2e");
    expect(inboundData.autoReplied).toBe(true);
    expect(inboundData.reply).toBe("AI auto-reply text");

    // Verify channel was auto-created
    expect(prisma.channel.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "messenger",
        displayName: "Facebook Messenger",
        isCustom: true,
        isActive: true,
      }),
    });

    // ─── Step 2: Staff replies via dashboard ─────────────────────────
    const { POST: messagesPOST } = await import("@/app/api/conversations/[id]/messages/route");

    // Mock conversation lookup for staff reply
    (prisma.conversation.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "conv-e2e",
      channel: "messenger",
      customerName: "Jane Doe",
      customerContact: "fb_jane_123",
      metadata: { threadId: "msg_thread_abc" },
    });
    // Mock channel for outbound webhook
    (prisma.channel.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ch-messenger",
      type: "messenger",
      isActive: true,
      isCustom: true,
      displayName: "Facebook Messenger",
      outboundWebhookUrl: "https://n8n.example.com/webhook/messenger-reply",
      outboundWebhookHeaders: {},
    });
    (prisma.message.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "msg-staff-1",
      conversationId: "conv-e2e",
      role: "assistant",
      content: "Your order #42 has been shipped and will arrive tomorrow.",
    });
    mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: "OK" });

    const staffReplyRequest = createRequest("/api/conversations/conv-e2e/messages", {
      method: "POST",
      body: {
        content: "Your order #42 has been shipped and will arrive tomorrow.",
        role: "assistant",
      },
    });

    // The messages route uses params — we need to pass them correctly
    const params = Promise.resolve({ id: "conv-e2e" });
    const staffResponse = await messagesPOST(staffReplyRequest, { params });
    expect(staffResponse.status).toBe(201);

    // Wait for the async outbound webhook to fire
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify outbound webhook was fired
    expect(mockFetch).toHaveBeenCalledWith(
      "https://n8n.example.com/webhook/messenger-reply",
      expect.objectContaining({ method: "POST" })
    );
    const outboundCall = mockFetch.mock.calls[0];
    const outboundBody = JSON.parse(outboundCall[1].body as string);
    expect(outboundBody.channel).toBe("messenger");
    expect(outboundBody.recipient_id).toBe("fb_jane_123");
    expect(outboundBody.recipient_name).toBe("Jane Doe");
    expect(outboundBody.message_text).toContain("order #42");
    expect(outboundBody.thread_id).toBe("msg_thread_abc");
  });

  it("disabled channel: n8n sends message → 403 returned → no conversation created", async () => {
    const { POST: inboundPOST } = await import("@/app/api/webhooks/inbound/route");

    (prisma.channel.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ch-disabled",
      type: "instagram",
      isActive: false,
      isCustom: true,
      displayName: "Instagram DMs",
      outboundWebhookUrl: "",
      outboundWebhookHeaders: {},
      autoReplyEnabled: true,
      status: "disconnected",
      disabledReason: "Temporarily disabled for maintenance",
    });

    const inboundRequest = createRequest("/api/webhooks/inbound", {
      method: "POST",
      headers: { "x-webhook-secret": "e2e-secret" },
      body: {
        channel: "instagram",
        sender_name: "John",
        sender_id: "ig_123",
        message: "Hello",
      },
    });

    const response = await inboundPOST(inboundRequest);
    expect(response.status).toBe(403);
    const data = await parseJsonResponse(response);
    expect(data.disabled).toBe(true);
    expect(data.disabledReason).toContain("maintenance");
    // No conversation should have been created
    expect(prisma.conversation.findFirst).not.toHaveBeenCalled();
  });
});
