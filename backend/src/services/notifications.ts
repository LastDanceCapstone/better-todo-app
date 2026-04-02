// src/services/notifications.ts
import { NotificationType } from '@prisma/client';
import { prisma } from '../prisma';

export const createNotification = async (
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
) => {
  return prisma.notification.create({
    data: { userId, type, title, message },
  });
};

export const getUserNotifications = async (userId: string) => {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
};

export const markNotificationAsRead = async (notificationId: string, userId: string) => {
  // Verify the notification belongs to the requesting user before updating
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) return null;
  if (notification.userId !== userId) return 'forbidden';
  if (notification.isRead) return notification; // already read — no-op

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true, readAt: new Date() },
  });
};

/**
 * Returns true if a notification of the given type has already been created
 * for the user on the current calendar day (UTC). Used for duplicate prevention
 * in scheduled jobs.
 */
export const hasNotificationOfTypeForUserToday = async (
  userId: string,
  type: NotificationType,
): Promise<boolean> => {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);

  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      type,
      createdAt: { gte: start, lte: end },
    },
  });
  return existing !== null;
};
