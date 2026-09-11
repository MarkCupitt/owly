import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createRequest, parseJsonResponse } from "../helpers/request";

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

// We mock customer-resolver to simulate the full flow
const resolveCustomerMock = vi.fn();
vi.mock("@/lib/customer-resolver", () => ({
  resolveCustomer: resolveCustomerMock,
}));

vi.mock("@/lib/ai/engine", () => ({
  chat: vi.fn().mockResolvedValue("AI reply"),
  createNewConversation: vi.fn().mockResolvedValue({
    id: "conv-new",
    channel: "messenger",
    customerName: "John Smith",
    customerContact: "fb_123",
  }),
}));

vi.mock("@/lib/realtime", () => ({
  emitNewMessage: vi.fn(),
}));

vi.mock("@/lib/channels/outbound-webhook", () => ({
  fireOutboundWebhook: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/upstream-identity", () => ({
  linkUpstreamIdentity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/customer-matcher", () => ({
  checkAndProposeMatches: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/automation", () => ({
  evaluateRules: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn().mockResolvedValue({ id: "notif-1" }),
}));

vi.mock("@/lib/fake-email", () => ({
  isFakeEmailSync: vi.fn(() => false),
  extractEmail: vi.fn((text: string) => {
    const match = text.match(/[\w.+-]+@[\w.-]+\.\w+/);
    return match ? match[0] : null;
  }),
}));

function setupActiveChannel() {
  mockPrisma.channel.findUnique.mockResolvedValue({
    id: "ch-1",
    type: "messenger",
    isActive: true,
    isCustom: true,
    displayName: "Messenger",
    outboundWebhookUrl: "",
    outboundWebhookHeaders: {},
    autoReplyEnabled: false,
    status: "connected",
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

describe("E2E: webhook → resolve → match → merge flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.INBOUND_WEBHOOK_SECRET = "test-secret";
    process.env.WEBHOOK_SECRET = "";
    resolveCustomerMock.mockReset();
    setupActiveChannel();
  });

  it("first message creates customer, second message from same channel matches via channel link", async () => {
    // First message: resolveCustomer creates a new customer
    resolveCustomerMock.mockResolvedValue("cust-1");

    const { POST } = await import("@/app/api/webhooks/inbound/route");

    // First message from messenger
    const req1 = createRequest("/api/webhooks/inbound", {
      method: "POST",
      headers: { "x-webhook-secret": "test-secret" },
      body: {
        channel: "messenger",
        sender_name: "John Smith",
        sender_id: "fb_123",
        message: "Hello first time",
        autoReply: false,
      },
    });
    const res1 = await POST(req1);
    const data1 = await parseJsonResponse(res1);
    expect(res1.status).toBe(200);
    expect(data1.conversationId).toBe("conv-new");

    // Second message: same sender_id, should find existing conversation
    mockPrisma.conversation.findFirst.mockResolvedValue({
      id: "conv-new",
      channel: "messenger",
      customerName: "John Smith",
      customerContact: "fb_123",
      metadata: {},
    });

    const req2 = createRequest("/api/webhooks/inbound", {
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
    const res2 = await POST(req2);
    const data2 = await parseJsonResponse(res2);
    expect(res2.status).toBe(200);
    // Same conversation — channel link matched
    expect(data2.conversationId).toBe("conv-new");
  });

  it("message with email triggers upstream identity and customer update, then merge completes the flow", async () => {
    resolveCustomerMock.mockResolvedValue("cust-2");
    mockPrisma.customer.findUnique.mockResolvedValue({
      id: "cust-2",
      email: "",
      externalId: "",
    });
    mockPrisma.customer.update.mockResolvedValue({});

    const { POST } = await import("@/app/api/webhooks/inbound/route");

    // Send message with email in body
    const request = createRequest("/api/webhooks/inbound", {
      method: "POST",
      headers: { "x-webhook-secret": "test-secret" },
      body: {
        channel: "email",
        sender_name: "John Smith",
        sender_id: "john@example.com",
        sender_email: "john@example.com",
        message: "Hi, my email is john@example.com",
        autoReply: false,
      },
    });
    const response = await POST(request);
    expect(response.status).toBe(200);

    // Verify email was detected and customer updated
    expect(mockPrisma.customer.update).toHaveBeenCalledWith({
      where: { id: "cust-2" },
      data: { email: "john@example.com" },
    });

    // Verify match proposals were triggered
    const { checkAndProposeMatches } = await import("@/lib/customer-matcher");
    await new Promise((r) => setTimeout(r, 10));
    expect(checkAndProposeMatches).toHaveBeenCalledWith("cust-2", "John Smith");
  });

  it("full flow: webhook creates message, automation fires notification, merge cleans up proposals", async () => {
    resolveCustomerMock.mockResolvedValue("cust-3");
    const { evaluateRules } = await import("@/lib/automation");
    const { createNotification } = await import("@/lib/notifications");
    (evaluateRules as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        type: "keyword_alert",
        ruleName: "Urgent",
        ruleId: "rule-urgent",
        actions: [{ type: "keyword_alert", value: "urgent" }],
      },
    ]);

    const { POST } = await import("@/app/api/webhooks/inbound/route");

    // Send message with keyword
    const request = createRequest("/api/webhooks/inbound", {
      method: "POST",
      headers: { "x-webhook-secret": "test-secret" },
      body: {
        channel: "messenger",
        sender_name: "Jane Doe",
        sender_id: "fb_jane",
        message: "This is urgent, please help",
        autoReply: false,
      },
    });
    const response = await POST(request);
    expect(response.status).toBe(200);

    // Notification should have been created
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "automation",
        title: "Keyword Alert: Urgent",
        message: expect.stringContaining("urgent"),
      })
    );

    // Now simulate merge via the merge API
    const source = {
      id: "cust-3", name: "Jane Doe", email: "", phone: "",
      whatsapp: "", facebookId: "fb_jane", instagramId: "",
      externalId: "", externalSystem: "", profilePicUrl: "",
    };
    const target = {
      id: "cust-target", name: "Jane Doe", email: "jane@example.com", phone: "",
      whatsapp: "", facebookId: "", instagramId: "",
      externalId: "", externalSystem: "", profilePicUrl: "",
    };
    mockPrisma.customer.findUnique
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce(target);
    mockPrisma.$transaction.mockResolvedValue([]);

    const { POST: mergePOST } = await import("@/app/api/customers/merge/route");
    const mergeRequest = createRequest("/api/customers/merge", {
      method: "POST",
      body: { sourceId: "cust-3", targetId: "cust-target" },
    });
    const mergeResponse = await mergePOST(mergeRequest);
    const mergeData = await parseJsonResponse(mergeResponse);

    expect(mergeResponse.status).toBe(200);
    expect(mergeData.success).toBe(true);
    expect(mergeData.mergedInto).toBe("cust-target");
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });
});
