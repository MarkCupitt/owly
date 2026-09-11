import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createRequest, parseJsonResponse } from "../helpers/request";

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

describe("GET /api/notifications", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns paginated notifications", async () => {
    mockPrisma.notification.findMany.mockResolvedValue([
      { id: "notif-1", type: "automation", title: "Alert", message: "Test", isRead: false, createdAt: new Date() },
    ]);
    mockPrisma.notification.count.mockResolvedValue(1);

    const { GET } = await import("@/app/api/notifications/route");
    const request = createRequest("/api/notifications");
    const response = await GET(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.notifications).toHaveLength(1);
    expect(data.unreadCount).toBeDefined();
  });

  it("filters unread only", async () => {
    mockPrisma.notification.findMany.mockResolvedValue([]);
    mockPrisma.notification.count.mockResolvedValue(0);

    const { GET } = await import("@/app/api/notifications/route");
    const request = createRequest("/api/notifications", {
      searchParams: { unreadOnly: "true" },
    });
    await GET(request);

    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isRead: false }),
      })
    );
  });
});

describe("PATCH /api/notifications/[id]", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("marks notification as read", async () => {
    mockPrisma.notification.update.mockResolvedValue({
      id: "notif-1", isRead: true,
    });

    const { PATCH } = await import("@/app/api/notifications/[id]/route");
    const request = createRequest("/api/notifications/notif-1", { method: "PATCH" });
    const params = { params: Promise.resolve({ id: "notif-1" }) };
    const response = await PATCH(request, params);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.isRead).toBe(true);
    expect(mockPrisma.notification.update).toHaveBeenCalledWith({
      where: { id: "notif-1" },
      data: { isRead: true },
    });
  });

  it("returns 404 when notification does not exist", async () => {
    const prismaError = { code: "P2025" };
    mockPrisma.notification.update.mockRejectedValue(prismaError);

    const { PATCH } = await import("@/app/api/notifications/[id]/route");
    const request = createRequest("/api/notifications/nonexistent", { method: "PATCH" });
    const params = { params: Promise.resolve({ id: "nonexistent" }) };
    const response = await PATCH(request, params);

    expect(response.status).toBe(404);
  });

  it("returns unread count in list response", async () => {
    mockPrisma.notification.findMany.mockResolvedValue([
      { id: "notif-1", type: "automation", title: "A", message: "M", isRead: false, createdAt: new Date() },
      { id: "notif-2", type: "system", title: "B", message: "N", isRead: true, createdAt: new Date() },
    ]);
    mockPrisma.notification.count.mockResolvedValue(2);
    mockPrisma.notification.aggregate.mockResolvedValue({ _count: { _all: 1 } });

    const { GET } = await import("@/app/api/notifications/route");
    const request = createRequest("/api/notifications");
    const response = await GET(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.total).toBe(2);
  });
});
