import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function createNotification(params: {
  type: string;
  title: string;
  message: string;
  entityId?: string;
  entityType?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const notification = await prisma.notification.create({
      data: {
        type: params.type,
        title: params.title,
        message: params.message,
        entityId: params.entityId,
        entityType: params.entityType,
        metadata: (params.metadata || {}) as any,
      },
    });

    logger.info("Notification created", { id: notification.id, type: notification.type });
  } catch (err) {
    logger.error("Failed to create notification", { error: err, ...params });
  }
}

export async function getUnreadCount(): Promise<number> {
  return prisma.notification.count({ where: { isRead: false } });
}
