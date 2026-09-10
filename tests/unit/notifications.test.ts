import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createNotification, getUnreadCount } from "@/lib/notifications";

describe("notifications", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (prisma.notification.create as ReturnType<typeof vi.fn>).mockReset();
    (prisma.notification.count as ReturnType<typeof vi.fn>).mockReset();
  });

  describe("createNotification", () => {
    it("creates a notification with all fields", async () => {
      (prisma.notification.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "notif-1",
        type: "automation",
        title: "Test Alert",
        message: "Something happened",
      });

      await createNotification({
        type: "automation",
        title: "Test Alert",
        message: "Something happened",
        entityId: "conv-1",
        entityType: "conversation",
        metadata: { ruleId: "rule-1" },
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "automation",
          title: "Test Alert",
          message: "Something happened",
          entityId: "conv-1",
          entityType: "conversation",
        }),
      });
    });

    it("does not throw on DB error", async () => {
      (prisma.notification.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB error"));

      await expect(
        createNotification({
          type: "system",
          title: "Test",
          message: "Test",
        })
      ).resolves.not.toThrow();
    });

    it("works with minimal fields", async () => {
      (prisma.notification.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "notif-2" });

      await createNotification({
        type: "system",
        title: "Minimal",
        message: "Minimal notification",
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "system",
          title: "Minimal",
          message: "Minimal notification",
          entityId: undefined,
          entityType: undefined,
        }),
      });
    });
  });

  describe("getUnreadCount", () => {
    it("returns count of unread notifications", async () => {
      (prisma.notification.count as ReturnType<typeof vi.fn>).mockResolvedValue(5);

      const count = await getUnreadCount();
      expect(count).toBe(5);
      expect(prisma.notification.count).toHaveBeenCalledWith({ where: { isRead: false } });
    });

    it("returns 0 when no unread notifications", async () => {
      (prisma.notification.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const count = await getUnreadCount();
      expect(count).toBe(0);
    });
  });
});
