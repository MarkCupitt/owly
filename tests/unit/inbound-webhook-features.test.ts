import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createRequest, parseJsonResponse } from "../helpers/request";

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

// Mock customer-resolver
const resolveCustomerMock = vi.fn().mockResolvedValue("cust-1");
vi.mock("@/lib/customer-resolver", () => ({
  resolveCustomer: resolveCustomerMock,
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

// Mock realtime
vi.mock("@/lib/realtime", () => ({
  emitNewMessage: vi.fn(),
}));

// Mock outbound webhook
vi.mock("@/lib/channels/outbound-webhook", () => ({
  fireOutboundWebhook: vi.fn().mockResolvedValue(undefined),
}));

// Mock upstream-identity
const linkUpstreamIdentityMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/upstream-identity", () => ({
  linkUpstreamIdentity: linkUpstreamIdentityMock,
}));

// Mock customer-matcher
const checkAndProposeMatchesMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/customer-matcher", () => ({
  checkAndProposeMatches: checkAndProposeMatchesMock,
}));

// Mock automation
const evaluateRulesMock = vi.fn().mockResolvedValue([]);
vi.mock("@/lib/automation", () => ({
  evaluateRules: evaluateRulesMock,
}));

// Mock notifications
const createNotificationMock = vi.fn().mockResolvedValue({ id: "notif-1" });
vi.mock("@/lib/notifications", () => ({
  createNotification: createNotificationMock,
}));

// Mock fake-email — use externally accessible mocks
const isFakeEmailSyncMock = vi.fn((email: string, domains?: string[]) => {
  if (domains?.includes("facebook.com") && email.endsWith("@facebook.com")) return true;
  return false;
});
const extractEmailMock = vi.fn((text: string) => {
  const match = text.match(/[\w.+-]+@[\w.-]+\.\w+/);
  return match ? match[0] : null;
});
vi.mock("@/lib/fake-email", () => ({
  isFakeEmailSync: isFakeEmailSyncMock,
  extractEmail: extractEmailMock,
}));

function setupChannelMock(active: boolean = true) {
  mockPrisma.channel.findUnique.mockResolvedValue({
    id: "ch-1",
    type: "messenger",
    isActive: active,
    isCustom: true,
    displayName: "Facebook Messenger",
    outboundWebhookUrl: "",
    outboundWebhookHeaders: {},
    autoReplyEnabled: false,
    status: active ? "connected" : "disconnected",
    disabledReason: "",
  });
  mockPrisma.conversation.findFirst.mockResolvedValue(null);
  mockPrisma.message.create.mockResolvedValue({
    id: "msg-1",
    conversationId: "conv-new",
    role: "customer",
    content: "test",
  });
  mockPrisma.conversation.update.mockResolvedValue({});
  mockPrisma.settings.findFirst.mockResolvedValue({ autoReplyEnabled: false });
}

function resetMocks() {
  resolveCustomerMock.mockReset();
  resolveCustomerMock.mockResolvedValue("cust-1");
  chatMock.mockReset();
  chatMock.mockResolvedValue("AI response text");
  linkUpstreamIdentityMock.mockReset();
  linkUpstreamIdentityMock.mockResolvedValue(undefined);
  checkAndProposeMatchesMock.mockReset();
  checkAndProposeMatchesMock.mockResolvedValue(undefined);
  evaluateRulesMock.mockReset();
  evaluateRulesMock.mockResolvedValue([]);
  createNotificationMock.mockReset();
  createNotificationMock.mockResolvedValue({ id: "notif-1" });
  isFakeEmailSyncMock.mockReset();
  isFakeEmailSyncMock.mockImplementation((email: string, domains?: string[]) => {
    if (domains?.includes("facebook.com") && email.endsWith("@facebook.com")) return true;
    return false;
  });
  extractEmailMock.mockReset();
  extractEmailMock.mockImplementation((text: string) => {
    const match = text.match(/[\w.+-]+@[\w.-]+\.\w+/);
    return match ? match[0] : null;
  });
}

describe("POST /api/webhooks/inbound — feature enhancements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INBOUND_WEBHOOK_SECRET = "test-secret";
    process.env.WEBHOOK_SECRET = "";
    resetMocks();
    setupChannelMock(true);
  });

  // ─── Email Detection ──────────────────────────────────
  it("detects email in message body and updates customer", async () => {
    mockPrisma.customer.findUnique.mockResolvedValue({
      id: "cust-1",
      email: "",
      externalId: "",
    });
    mockPrisma.customer.update.mockResolvedValue({});

    const { POST } = await import("@/app/api/webhooks/inbound/route");
    const request = createRequest("/api/webhooks/inbound", {
      method: "POST",
      headers: { "x-webhook-secret": "test-secret" },
      body: {
        channel: "messenger",
        sender_name: "John Smith",
        sender_id: "fb_123",
        message: "Contact me at john@example.com please",
        autoReply: false,
      },
    });
    const response = await POST(request);
    expect(response.status).toBe(200);

    // Customer email should be updated
    expect(mockPrisma.customer.update).toHaveBeenCalledWith({
      where: { id: "cust-1" },
      data: { email: "john@example.com" },
    });
  });

  it("does not update email if customer already has a real email", async () => {
    mockPrisma.customer.findUnique.mockResolvedValue({
      id: "cust-1",
      email: "existing@example.com",
      externalId: "",
    });

    const { POST } = await import("@/app/api/webhooks/inbound/route");
    const request = createRequest("/api/webhooks/inbound", {
      method: "POST",
      headers: { "x-webhook-secret": "test-secret" },
      body: {
        channel: "messenger",
        sender_name: "John Smith",
        sender_id: "fb_123",
        message: "My new email is new@example.com",
        autoReply: false,
      },
    });
    await POST(request);

    expect(mockPrisma.customer.update).not.toHaveBeenCalled();
  });

  it("filters fake emails (facebook.com)", async () => {
    mockPrisma.customer.findUnique.mockResolvedValue({
      id: "cust-1",
      email: "",
      externalId: "",
    });

    const { POST } = await import("@/app/api/webhooks/inbound/route");
    const request = createRequest("/api/webhooks/inbound", {
      method: "POST",
      headers: { "x-webhook-secret": "test-secret" },
      body: {
        channel: "messenger",
        sender_name: "John Smith",
        sender_id: "fb_123",
        message: "Email me at user@facebook.com",
        autoReply: false,
      },
    });
    await POST(request);

    expect(mockPrisma.customer.update).not.toHaveBeenCalled();
  });

  it("does not detect email when none in message body", async () => {
    const { POST } = await import("@/app/api/webhooks/inbound/route");
    const request = createRequest("/api/webhooks/inbound", {
      method: "POST",
      headers: { "x-webhook-secret": "test-secret" },
      body: {
        channel: "messenger",
        sender_name: "John Smith",
        sender_id: "fb_123",
        message: "Hello, I need help",
        autoReply: false,
      },
    });
    await POST(request);

    // customer.findUnique is only called inside the email detection block
    expect(mockPrisma.customer.findUnique).not.toHaveBeenCalled();
  });

  // ─── Upstream Identity ────────────────────────────────
  it("triggers linkUpstreamIdentity when email detected and no externalId", async () => {
    mockPrisma.customer.findUnique.mockResolvedValue({
      id: "cust-1",
      email: "",
      externalId: "",
    });
    mockPrisma.customer.update.mockResolvedValue({});

    const { POST } = await import("@/app/api/webhooks/inbound/route");
    const request = createRequest("/api/webhooks/inbound", {
      method: "POST",
      headers: { "x-webhook-secret": "test-secret" },
      body: {
        channel: "messenger",
        sender_name: "John Smith",
        sender_id: "fb_123",
        message: "My email is john@example.com",
        autoReply: false,
      },
    });
    await POST(request);

    // linkUpstreamIdentity is called async (fire-and-forget with .catch)
    // Give it a tick to resolve
    await new Promise((r) => setTimeout(r, 10));
    expect(linkUpstreamIdentityMock).toHaveBeenCalledWith("cust-1", "john@example.com");
  });

  it("does not trigger linkUpstreamIdentity when customer already has externalId", async () => {
    mockPrisma.customer.findUnique.mockResolvedValue({
      id: "cust-1",
      email: "",
      externalId: "ext-123",
    });
    mockPrisma.customer.update.mockResolvedValue({});

    const { POST } = await import("@/app/api/webhooks/inbound/route");
    const request = createRequest("/api/webhooks/inbound", {
      method: "POST",
      headers: { "x-webhook-secret": "test-secret" },
      body: {
        channel: "messenger",
        sender_name: "John Smith",
        sender_id: "fb_123",
        message: "My email is john@example.com",
        autoReply: false,
      },
    });
    await POST(request);
    await new Promise((r) => setTimeout(r, 10));

    expect(linkUpstreamIdentityMock).not.toHaveBeenCalled();
  });

  // ─── Match Proposals ──────────────────────────────────
  it("triggers checkAndProposeMatches with customer ID and sender name", async () => {
    const { POST } = await import("@/app/api/webhooks/inbound/route");
    const request = createRequest("/api/webhooks/inbound", {
      method: "POST",
      headers: { "x-webhook-secret": "test-secret" },
      body: {
        channel: "messenger",
        sender_name: "John Smith",
        sender_id: "fb_123",
        message: "Hello",
        autoReply: false,
      },
    });
    await POST(request);
    await new Promise((r) => setTimeout(r, 10));

    expect(checkAndProposeMatchesMock).toHaveBeenCalledWith("cust-1", "John Smith");
  });

  // ─── Automation Rules ─────────────────────────────────
  it("evaluates automation rules when autoReply is false", async () => {
    evaluateRulesMock.mockResolvedValue([
      {
        type: "keyword_alert",
        ruleName: "Billing Alert",
        ruleId: "rule-1",
        actions: [{ type: "keyword_alert", value: "billing" }],
      },
    ]);

    const { POST } = await import("@/app/api/webhooks/inbound/route");
    const request = createRequest("/api/webhooks/inbound", {
      method: "POST",
      headers: { "x-webhook-secret": "test-secret" },
      body: {
        channel: "messenger",
        sender_name: "John Smith",
        sender_id: "fb_123",
        message: "I have a billing question",
        autoReply: false,
      },
    });
    await POST(request);

    expect(evaluateRulesMock).toHaveBeenCalled();
    expect(createNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "automation",
        title: "Keyword Alert: Billing Alert",
      })
    );
  });

  it("does not evaluate automation rules when useAI and autoReply are true", async () => {
    setupChannelMock(true);
    mockPrisma.settings.findFirst.mockResolvedValue({ autoReplyEnabled: true });

    const { POST } = await import("@/app/api/webhooks/inbound/route");
    const request = createRequest("/api/webhooks/inbound", {
      method: "POST",
      headers: { "x-webhook-secret": "test-secret" },
      body: {
        channel: "messenger",
        sender_name: "John Smith",
        sender_id: "fb_123",
        message: "I have a billing question",
        autoReply: true,
        useAI: true,
      },
    });
    await POST(request);

    expect(evaluateRulesMock).not.toHaveBeenCalled();
  });

  it("handles automation rule evaluation errors gracefully", async () => {
    evaluateRulesMock.mockRejectedValue(new Error("Rule eval failed"));

    const { POST } = await import("@/app/api/webhooks/inbound/route");
    const request = createRequest("/api/webhooks/inbound", {
      method: "POST",
      headers: { "x-webhook-secret": "test-secret" },
      body: {
        channel: "messenger",
        sender_name: "John Smith",
        sender_id: "fb_123",
        message: "Hello",
        autoReply: false,
      },
    });
    const response = await POST(request);

    // Should not crash — should still return 200
    expect(response.status).toBe(200);
  });
});
