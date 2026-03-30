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
