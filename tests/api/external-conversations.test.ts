import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createRequest, parseJsonResponse } from "../helpers/request";

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

describe("GET /api/external/conversations", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns conversations filtered by externalId", async () => {
    const customer = { id: "cust-1", externalId: "ext-123", externalSystem: "powerdeck" };
    mockPrisma.customer.findFirst.mockResolvedValue(customer);
    mockPrisma.conversation.findMany.mockResolvedValue([
      { id: "conv-1", channel: "messenger", status: "active", customerName: "John", summary: null, createdAt: new Date(), updatedAt: new Date(), _count: { messages: 5 } },
    ]);
    mockPrisma.conversation.count.mockResolvedValue(1);

    const { GET } = await import("@/app/api/external/conversations/route");
    const request = createRequest("/api/external/conversations", {
      searchParams: { externalId: "ext-123", externalSystem: "powerdeck" },
    });
    const response = await GET(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.conversations).toHaveLength(1);
    expect(data.conversations[0].messageCount).toBe(5);
  });

  it("returns empty when customer not found by externalId", async () => {
    mockPrisma.customer.findFirst.mockResolvedValue(null);

    const { GET } = await import("@/app/api/external/conversations/route");
    const request = createRequest("/api/external/conversations", {
      searchParams: { externalId: "nonexistent", externalSystem: "powerdeck" },
    });
    const response = await GET(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.conversations).toHaveLength(0);
    expect(data.total).toBe(0);
  });

  it("returns conversations filtered by email", async () => {
    const customer = { id: "cust-1", email: "john@example.com" };
    mockPrisma.customer.findFirst.mockResolvedValue(customer);
    mockPrisma.conversation.findMany.mockResolvedValue([
      { id: "conv-1", channel: "email", status: "active", customerName: "John", summary: null, createdAt: new Date(), updatedAt: new Date(), _count: { messages: 3 } },
    ]);
    mockPrisma.conversation.count.mockResolvedValue(1);

    const { GET } = await import("@/app/api/external/conversations/route");
    const request = createRequest("/api/external/conversations", {
      searchParams: { email: "john@example.com" },
    });
    const response = await GET(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.conversations).toHaveLength(1);
  });

  it("returns 400 when no filter provided", async () => {
    const { GET } = await import("@/app/api/external/conversations/route");
    const request = createRequest("/api/external/conversations");
    const response = await GET(request);

    expect(response.status).toBe(400);
  });
});

describe("GET /api/external/conversations/[id]/messages", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns messages for a conversation", async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: "conv-1", customerId: "cust-1",
    });
    mockPrisma.customer.findFirst.mockResolvedValue({
      id: "cust-1", externalId: "ext-123",
    });
    mockPrisma.message.findMany.mockResolvedValue([
      { id: "msg-1", role: "customer", content: "Hello", createdAt: new Date() },
      { id: "msg-2", role: "assistant", content: "Hi there!", createdAt: new Date() },
    ]);

    const { GET } = await import("@/app/api/external/conversations/[id]/messages/route");
    const request = createRequest("/api/external/conversations/conv-1/messages", {
      searchParams: { externalId: "ext-123", externalSystem: "powerdeck" },
    });
    const params = { params: Promise.resolve({ id: "conv-1" }) };
    const response = await GET(request, params);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.messages).toHaveLength(2);
  });

  it("returns 404 when conversation not found", async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue(null);

    const { GET } = await import("@/app/api/external/conversations/[id]/messages/route");
    const request = createRequest("/api/external/conversations/nonexistent/messages", {
      searchParams: { externalId: "ext-123" },
    });
    const params = { params: Promise.resolve({ id: "nonexistent" }) };
    const response = await GET(request, params);

    expect(response.status).toBe(404);
  });

  it("returns 403 when customer externalId does not match", async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: "conv-1", customerId: "cust-1",
    });
    mockPrisma.customer.findFirst.mockResolvedValue({
      id: "cust-different", externalId: "ext-different",
    });

    const { GET } = await import("@/app/api/external/conversations/[id]/messages/route");
    const request = createRequest("/api/external/conversations/conv-1/messages", {
      searchParams: { externalId: "ext-123", externalSystem: "powerdeck" },
    });
    const params = { params: Promise.resolve({ id: "conv-1" }) };
    const response = await GET(request, params);

    expect(response.status).toBe(403);
  });
});
