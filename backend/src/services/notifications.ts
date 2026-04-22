// src/services/notifications.ts
import { NotificationType } from '@prisma/client';
import { prisma } from '../prisma';

export type NotificationSettingsShape = {
  pushEnabled: boolean;
  morningOverview: boolean;
  eveningReview: boolean;
  dueSoonNotifications: boolean;
  overdueNotifications: boolean;
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettingsShape = {
  pushEnabled: true,
  morningOverview: true,
  eveningReview: true,
  dueSoonNotifications: true,
  overdueNotifications: true,
};

export type CreateNotificationResult = {
  notification: any;
  wasCreated: boolean;
};

const toSettingsResponse = (settings: any): NotificationSettingsShape => ({
  pushEnabled: settings.pushEnabled,
  morningOverview: settings.morningOverview,
  eveningReview: settings.eveningReview,
  dueSoonNotifications: settings.dueSoonNotifications,
  overdueNotifications: settings.overdueNotifications,
});

export const createNotification = async (
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  options?: {
    taskId?: string | null;
    dedupeKey?: string | null;
  },
): Promise<CreateNotificationResult> => {
  if (options?.taskId) {
    const task = await prisma.task.findFirst({
      where: {
        id: options.taskId,
        userId,
      },
      select: { id: true },
    });

    if (!task) {
      const error = new Error('Task not found for this user');
      (error as any).code = 'TASK_NOT_FOUND_OR_FORBIDDEN';
      throw error;
    }
  }

  try {
    const created = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        taskId: options?.taskId ?? null,
        dedupeKey: options?.dedupeKey ?? null,
      },
    });
    return { notification: created, wasCreated: true };
  } catch (error: any) {
    // Unique dedupe key collision means this notification was already created.
    if (error?.code === 'P2002' && options?.dedupeKey) {
      const existing = await prisma.notification.findFirst({
        where: {
          dedupeKey: options.dedupeKey,
          userId,
        },
      });
      if (existing) return { notification: existing, wasCreated: false };
    }
    throw error;
  }
};

export const getUserNotifications = async (userId: string) => {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
};

export const getUnreadNotificationCount = async (userId: string): Promise<number> => {
  return prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });
};

export const getNotificationSettings = async (userId: string): Promise<NotificationSettingsShape> => {
  const settings = await prisma.notificationSettings.upsert({
    where: { userId },
    create: {
      userId,
      ...DEFAULT_NOTIFICATION_SETTINGS,
    },
    update: {},
  });

  return toSettingsResponse(settings);
};

export const updateNotificationSettings = async (
  userId: string,
  patch: Partial<NotificationSettingsShape>,
): Promise<NotificationSettingsShape> => {
  const settings = await prisma.notificationSettings.upsert({
    where: { userId },
    create: {
      userId,
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...patch,
    },
    update: patch,
  });

  return toSettingsResponse(settings);
};

export const markNotificationAsRead = async (notificationId: string, userId: string) => {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (!notification) return null;
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
