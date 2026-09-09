import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createRequest, parseJsonResponse } from "../helpers/request";

// Mock customer-resolver
vi.mock("@/lib/customer-resolver", () => ({
  resolveCustomer: vi.fn().mockResolvedValue("cust-1"),
}));

// Mock AI engine
const chatMock = vi.fn().mockResolvedValue("AI response text");
vi.mock("@/lib/ai/engine", () => ({
  chat: chatMock,
  createNewConversation: vi.fn().mockResolvedValue({
    id: "conv-new",
    channel: "messenger",
    customerName: "John Smith",
    customerContact: "fb_123",
  }),
}));

describe("POST /api/webhooks/inbound", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.INBOUND_WEBHOOK_SECRET = "test-secret";
    process.env.WEBHOOK_SECRET = "";

    chatMock.mockReset();
    chatMock.mockResolvedValue("AI response text");

    // Reset prisma mocks
    (prisma.channel.findUnique as ReturnType<typeof vi.fn>).mockReset();
    (prisma.channel.create as ReturnType<typeof vi.fn>).mockReset();
    (prisma.conversation.findFirst as ReturnType<typeof vi.fn>).mockReset();
    (prisma.conversation.update as ReturnType<typeof vi.fn>).mockReset();
    (prisma.message.create as ReturnType<typeof vi.fn>).mockReset();
    (prisma.settings.findFirst as ReturnType<typeof vi.fn>).mockReset();

    // Default mocks
    (prisma.message.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "msg-1",
      conversationId: "conv-1",
      role: "customer",
      content: "test message",
    });
    (prisma.conversation.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.settings.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      autoReplyEnabled: true,
    });
  });

  it("should reject request without X-Webhook-Secret header", async () => {
    const { POST } = await import("@/app/api/webhooks/inbound/route");
    const request = createRequest("/api/webhooks/inbound", {
      method: "POST",
      body: {
        channel: "messenger",
        sender_name: "John",
        sender_id: "123",
        message: "Hello",
      },
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("should reject request with wrong secret", async () => {
    const { POST } = await import("@/app/api/webhooks/inbound/route");
    const request = createRequest("/api/webhooks/inbound", {
      method: "POST",
      headers: { "x-webhook-secret": "wrong-secret" },
      body: {
        channel: "messenger",
        sender_name: "John",
        sender_id: "123",
        message: "Hello",
      },
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("should reject request missing channel", async () => {
    const { POST } = await import("@/app/api/webhooks/inbound/route");
    const request = createRequest("/api/webhooks/inbound", {
      method: "POST",
      headers: { "x-webhook-secret": "test-secret" },
      body: {
        sender_name: "John",
        sender_id: "123",
        message: "Hello",
      },
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("should reject request missing message", async () => {
    const { POST } = await import("@/app/api/webhooks/inbound/route");
    const request = createRequest("/api/webhooks/inbound", {
      method: "POST",
      headers: { "x-webhook-secret": "test-secret" },
      body: {
        channel: "messenger",
        sender_name: "John",
        sender_id: "123",
      },
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("should reject request missing sender_id", async () => {
    const { POST } = await import("@/app/api/webhooks/inbound/route");
    const request = createRequest("/api/webhooks/inbound", {
      method: "POST",
      headers: { "x-webhook-secret": "test-secret" },
      body: {
        channel: "messenger",
        sender_name: "John",
        message: "Hello",
      },
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("should auto-create channel if it does not exist", async () => {
    const { POST } = await import("@/app/api/webhooks/inbound/route");
    const newChannel = {
      id: "ch-1",
      type: "messenger",
      isActive: true,
      isCustom: true,
      displayName: "Facebook Messenger",
      outboundWebhookUrl: "",
      outboundWebhookHeaders: {},
      autoReplyEnabled: true,
      status: "connected",
      disabledReason: "",
    };
    (prisma.channel.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.channel.create as ReturnType<typeof vi.fn>).mockResolvedValue(newChannel);
    (prisma.conversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const request = createRequest("/api/webhooks/inbound", {
      method: "POST",
      headers: { "x-webhook-secret": "test-secret" },
      body: {
        channel: "messenger",
        channelDisplayName: "Facebook Messenger",
        sender_name: "John Smith",
        sender_id: "fb_123",
        message: "Hi there",
      },
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await parseJsonResponse(response);
    expect(data.conversationId).toBe("conv-new");
    expect(data.channelId).toBe("ch-1");
    expect(prisma.channel.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "messenger",
        displayName: "Facebook Messenger",
        isCustom: true,
        isActive: true,
      }),
    });
  });

  it("should return 403 when channel is disabled", async () => {
    const { POST } = await import("@/app/api/webhooks/inbound/route");
    (prisma.channel.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ch-1",
      type: "messenger",
      isActive: false,
      isCustom: true,
      displayName: "Facebook Messenger",
      outboundWebhookUrl: "",
      outboundWebhookHeaders: {},
      autoReplyEnabled: true,
      status: "disconnected",
      disabledReason: "Manually disabled",
    });

    const request = createRequest("/api/webhooks/inbound", {
      method: "POST",
      headers: { "x-webhook-secret": "test-secret" },
      body: {
        channel: "messenger",
        sender_name: "John Smith",
        sender_id: "fb_123",
        message: "Hi there",
      },
    });
    const response = await POST(request);
    expect(response.status).toBe(403);
    const data = await parseJsonResponse(response);
    expect(data.disabled).toBe(true);
    expect(data.channel).toBe("messenger");
  });

  it("should find existing conversation for same channel + customer", async () => {
    const { POST } = await import("@/app/api/webhooks/inbound/route");
    (prisma.channel.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ch-1",
      type: "messenger",
      isActive: true,
      isCustom: true,
      displayName: "Facebook Messenger",
      outboundWebhookUrl: "",
      outboundWebhookHeaders: {},
      autoReplyEnabled: true,
      status: "connected",
      disabledReason: "",
    });
    (prisma.conversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "conv-existing",
      channel: "messenger",
      customerName: "John Smith",
      customerContact: "fb_123",
      metadata: {},
    });

    const request = createRequest("/api/webhooks/inbound", {
      method: "POST",
      headers: { "x-webhook-secret": "test-secret" },
      body: {
        channel: "messenger",
        sender_name: "John Smith",
        sender_id: "fb_123",
        message: "Follow up message",
        autoReply: false,
      },
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await parseJsonResponse(response);
    expect(data.conversationId).toBe("conv-existing");
    expect(data.autoReplied).toBe(false);
    expect(data.reply).toBe(null);
  });

  it("should auto-reply when autoReply is true in payload", async () => {
    const { POST } = await import("@/app/api/webhooks/inbound/route");
    const { chat } = await import("@/lib/ai/engine");
    (prisma.channel.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ch-1",
      type: "messenger",
      isActive: true,
      isCustom: true,
      displayName: "Facebook Messenger",
      outboundWebhookUrl: "",
      outboundWebhookHeaders: {},
      autoReplyEnabled: true,
      status: "connected",
      disabledReason: "",
    });
    (prisma.conversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const request = createRequest("/api/webhooks/inbound", {
      method: "POST",
      headers: { "x-webhook-secret": "test-secret" },
      body: {
        channel: "messenger",
        sender_name: "John Smith",
        sender_id: "fb_123",
        message: "I need help",
        autoReply: true,
      },
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await parseJsonResponse(response);
    expect(data.autoReplied).toBe(true);
    expect(data.reply).toBe("AI response text");
    expect(chat).toHaveBeenCalled();
  });

  it("should not auto-reply when autoReply is false in payload (overrides channel config)", async () => {
    const { POST } = await import("@/app/api/webhooks/inbound/route");
    (prisma.channel.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ch-1",
      type: "messenger",
      isActive: true,
      isCustom: true,
      displayName: "Facebook Messenger",
      outboundWebhookUrl: "",
      outboundWebhookHeaders: {},
      autoReplyEnabled: true,
      status: "connected",
      disabledReason: "",
    });
    (prisma.conversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const request = createRequest("/api/webhooks/inbound", {
      method: "POST",
      headers: { "x-webhook-secret": "test-secret" },
      body: {
        channel: "messenger",
        sender_name: "John Smith",
        sender_id: "fb_123",
        message: "I need help",
        autoReply: false,
      },
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await parseJsonResponse(response);
    expect(data.autoReplied).toBe(false);
    expect(chatMock).not.toHaveBeenCalled();
  });

  it("should not run AI when useAI is false in payload", async () => {
    const { POST } = await import("@/app/api/webhooks/inbound/route");
    (prisma.channel.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ch-1",
      type: "messenger",
      isActive: true,
      isCustom: true,
      displayName: "Facebook Messenger",
      outboundWebhookUrl: "",
      outboundWebhookHeaders: {},
      autoReplyEnabled: true,
      status: "connected",
      disabledReason: "",
    });
    (prisma.conversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const request = createRequest("/api/webhooks/inbound", {
      method: "POST",
      headers: { "x-webhook-secret": "test-secret" },
      body: {
        channel: "messenger",
        sender_name: "John Smith",
        sender_id: "fb_123",
        message: "I need help",
        autoReply: true,
        useAI: false,
      },
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await parseJsonResponse(response);
    expect(data.autoReplied).toBe(false);
    expect(chatMock).not.toHaveBeenCalled();
  });

  it("should fall back to WEBHOOK_SECRET if INBOUND_WEBHOOK_SECRET not set", async () => {
    delete process.env.INBOUND_WEBHOOK_SECRET;
    process.env.WEBHOOK_SECRET = "fallback-secret";
    const { POST } = await import("@/app/api/webhooks/inbound/route");
    (prisma.channel.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ch-1",
      type: "messenger",
      isActive: true,
      isCustom: true,
      displayName: "Facebook Messenger",
      outboundWebhookUrl: "",
      outboundWebhookHeaders: {},
      autoReplyEnabled: true,
      status: "connected",
      disabledReason: "",
    });
    (prisma.conversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const request = createRequest("/api/webhooks/inbound", {
      method: "POST",
      headers: { "x-webhook-secret": "fallback-secret" },
      body: {
        channel: "messenger",
        sender_name: "John Smith",
        sender_id: "fb_123",
        message: "Hi",
        autoReply: false,
      },
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
