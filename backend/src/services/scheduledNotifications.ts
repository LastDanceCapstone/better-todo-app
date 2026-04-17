import { prisma } from '../prisma';
import {
  createNotification,
  getNotificationSettings,
} from './notifications';
import { NotificationType } from '@prisma/client';
import { logger } from '../utils/logger';
import { sendPushForNotification } from './pushDelivery';
import {
  getLocalDateKey,
  getUtcRangeForLocalDateKey,
  isLocalTimeMatch,
  normalizeTimeZone,
} from '../utils/timezone';

const MORNING_OVERVIEW_HOUR = 9;
const EVENING_REVIEW_HOUR = 17;
const ONE_HOUR_MS = 60 * 60 * 1000;
const SCHEDULER_MINUTE_WINDOW_MS = 60 * 1000;

const buildDedupeKey = (parts: Array<string | number>) => parts.join(':');

async function deliverPushForCreatedNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  options?: {
    taskId?: string | null;
    notificationId?: string | null;
  },
): Promise<void> {
  try {
    const summary = await sendPushForNotification(userId, type, title, message, options);
    if (summary.attempted > 0) {
      logger.info(
        `[Scheduler] Push sent for ${type} — attempted: ${summary.attempted}, sent: ${summary.sent}, invalidRemoved: ${summary.invalidTokensRemoved}`,
      );
    }
  } catch {
    logger.error(`[Scheduler] Push delivery failed for ${type}`);
  }
}

/**
 * Returns all users in the system.
 */
export async function getAllUsers() {
  return prisma.user.findMany({ select: { id: true, firstName: true, timezone: true } });
}

/**
 * Returns all tasks due today for a user.
 */
export async function getTasksDueOnLocalDate(userId: string, timezone: string, localDateKey: string) {
  const { startUtc, endUtc } = getUtcRangeForLocalDateKey(localDateKey, timezone);

  return prisma.task.findMany({
    where: {
      userId,
      status: { in: ['TODO', 'IN_PROGRESS'] },
      dueAt: { gte: startUtc, lte: endUtc },
    },
  });
}

/**
 * Returns all incomplete tasks for a user.
 */
export async function getIncompleteTasks(userId: string) {
  return prisma.task.findMany({
    where: {
      userId,
      status: { in: ['TODO', 'IN_PROGRESS'] },
    },
  });
}

export async function getDueSoonTasks(userId: string, dueAtStart: Date, dueAtEndExclusive: Date) {
  return prisma.task.findMany({
    where: {
      userId,
      status: { in: ['TODO', 'IN_PROGRESS'] },
      dueAt: {
        gte: dueAtStart,
        lt: dueAtEndExclusive,
      },
    },
  });
}

export async function getOverdueTasks(userId: string, dueAtLowerExclusive: Date, dueAtUpperInclusive: Date) {
  return prisma.task.findMany({
    where: {
      userId,
      status: { in: ['TODO', 'IN_PROGRESS'] },
      dueAt: {
        gt: dueAtLowerExclusive,
        lte: dueAtUpperInclusive,
      },
    },
  });
}

/**
 * Sends Morning Overview notifications to all users.
 * Skips users who already received one today (duplicate prevention).
 */
export async function sendMorningNotifications(): Promise<void> {
  logger.info('[Scheduler] Morning Overview job started');
  const users = await getAllUsers();
  const now = new Date();
  let created = 0;
  let skipped = 0;

  for (const user of users) {
    try {
      const timezone = normalizeTimeZone(user.timezone);
      if (!isLocalTimeMatch(now, timezone, MORNING_OVERVIEW_HOUR, 0)) {
        skipped++;
        continue;
      }

      const settings = await getNotificationSettings(user.id);
      if (!settings.morningOverview) {
        skipped++;
        continue;
      }

      const localDateKey = getLocalDateKey(now, timezone);
      const dueTasks = await getTasksDueOnLocalDate(user.id, timezone, localDateKey);
      const dedupeKey = buildDedupeKey([
        'MORNING_OVERVIEW',
        user.id,
        localDateKey,
      ]);
      const title = `Good morning${user.firstName ? ', ' + user.firstName : ''}!`;
      const message = `You have ${dueTasks.length} task${dueTasks.length === 1 ? '' : 's'} due today.`;

      const { notification, wasCreated } = await createNotification(
        user.id,
        NotificationType.MORNING_OVERVIEW,
        title,
        message,
        { dedupeKey },
      );

      if (wasCreated) {
        await deliverPushForCreatedNotification(
          user.id,
          NotificationType.MORNING_OVERVIEW,
          title,
          message,
          { notificationId: notification.id },
        );
        created++;
      } else {
        skipped++;
      }
    } catch (err) {
      logger.error('[Scheduler] Failed MORNING_OVERVIEW notification creation');
    }
  }

  logger.info(
    `[Scheduler] Morning Overview job finished — created: ${created}, skipped: ${skipped}`,
  );
}

/**
 * Sends Evening Review notifications to all users.
 * Skips users who already received one today (duplicate prevention).
 */
export async function sendEveningNotifications(): Promise<void> {
  logger.info('[Scheduler] Evening Review job started');
  const users = await getAllUsers();
  const now = new Date();
  let created = 0;
  let skipped = 0;

  for (const user of users) {
    try {
      const timezone = normalizeTimeZone(user.timezone);
      if (!isLocalTimeMatch(now, timezone, EVENING_REVIEW_HOUR, 0)) {
        skipped++;
        continue;
      }

      const settings = await getNotificationSettings(user.id);
      if (!settings.eveningReview) {
        skipped++;
        continue;
      }

      const incompleteTasks = await getIncompleteTasks(user.id);
      const localDateKey = getLocalDateKey(now, timezone);
      const dedupeKey = buildDedupeKey([
        'EVENING_REVIEW',
        user.id,
        localDateKey,
      ]);
      const title = 'Evening Review';
      const message = `${incompleteTasks.length} task${incompleteTasks.length === 1 ? '' : 's'} still remaining today. Take a moment to review them.`;

      const { notification, wasCreated } = await createNotification(
        user.id,
        NotificationType.EVENING_REVIEW,
        title,
        message,
        { dedupeKey },
      );

      if (wasCreated) {
        await deliverPushForCreatedNotification(
          user.id,
          NotificationType.EVENING_REVIEW,
          title,
          message,
          { notificationId: notification.id },
        );
        created++;
      } else {
        skipped++;
      }
    } catch (err) {
      logger.error('[Scheduler] Failed EVENING_REVIEW notification creation');
    }
  }

  logger.info(
    `[Scheduler] Evening Review job finished — created: ${created}, skipped: ${skipped}`,
  );
}

export async function sendDueSoonNotifications(): Promise<void> {
  logger.info('[Scheduler] Due Soon job started');
  const users = await getAllUsers();
  const now = new Date();
  const dueSoonStart = new Date(now.getTime() + ONE_HOUR_MS);
  const dueSoonEnd = new Date(dueSoonStart.getTime() + SCHEDULER_MINUTE_WINDOW_MS);
  let created = 0;
  let skipped = 0;

  for (const user of users) {
    try {
      const settings = await getNotificationSettings(user.id);
      if (!settings.dueSoonNotifications) {
        skipped++;
        continue;
      }

      const dueSoonTasks = await getDueSoonTasks(user.id, dueSoonStart, dueSoonEnd);
      for (const task of dueSoonTasks) {
        if (!task.dueAt) continue;

        const dueAtIso = task.dueAt.toISOString();
        const dedupeKey = buildDedupeKey([
          'TASK_DUE_SOON',
          user.id,
          task.id,
          dueAtIso,
        ]);

        const title = 'Task due soon';
        const message = `"${task.title}" is due in 1 hour.`;

        const { notification, wasCreated } = await createNotification(
          user.id,
          NotificationType.TASK_DUE_SOON,
          title,
          message,
          { taskId: task.id, dedupeKey },
        );

        if (wasCreated) {
          await deliverPushForCreatedNotification(
            user.id,
            NotificationType.TASK_DUE_SOON,
            title,
            message,
            {
              taskId: task.id,
              notificationId: notification.id,
            },
          );
          created++;
        } else {
          skipped++;
        }
      }
    } catch (err) {
      logger.error('[Scheduler] Failed TASK_DUE_SOON notification creation');
    }
  }

  logger.info(`[Scheduler] Due Soon job finished — created: ${created}, skipped: ${skipped}`);
}

export async function sendOverdueNotifications(): Promise<void> {
  logger.info('[Scheduler] Overdue job started');
  const users = await getAllUsers();
  const now = new Date();
  const overdueDueAtUpperInclusive = new Date(now.getTime() - ONE_HOUR_MS);
  const overdueDueAtLowerExclusive = new Date(overdueDueAtUpperInclusive.getTime() - SCHEDULER_MINUTE_WINDOW_MS);
  let created = 0;
  let skipped = 0;

  for (const user of users) {
    try {
      const settings = await getNotificationSettings(user.id);
      if (!settings.overdueNotifications) {
        skipped++;
        continue;
      }

      const overdueTasks = await getOverdueTasks(
        user.id,
        overdueDueAtLowerExclusive,
        overdueDueAtUpperInclusive,
      );
      for (const task of overdueTasks) {
        if (!task.dueAt) continue;

        const dueAtIso = task.dueAt.toISOString();
        const dedupeKey = buildDedupeKey([
          'TASK_OVERDUE',
          user.id,
          task.id,
          dueAtIso,
        ]);

        const title = 'Task overdue';
        const message = `"${task.title}" has been overdue for 1 hour.`;

        const { notification, wasCreated } = await createNotification(
          user.id,
          NotificationType.TASK_OVERDUE,
          title,
          message,
          { taskId: task.id, dedupeKey },
        );

        if (wasCreated) {
          await deliverPushForCreatedNotification(
            user.id,
            NotificationType.TASK_OVERDUE,
            title,
            message,
            {
              taskId: task.id,
              notificationId: notification.id,
            },
          );
          created++;
        } else {
          skipped++;
        }
      }
    } catch (err) {
      logger.error('[Scheduler] Failed TASK_OVERDUE notification creation');
    }
  }

  logger.info(`[Scheduler] Overdue job finished — created: ${created}, skipped: ${skipped}`);
}

/**
 * Convenience wrapper that runs morning and evening jobs sequentially.
 * @deprecated Prefer calling sendMorningNotifications() and sendEveningNotifications()
 * directly via the scheduler so each runs at its configured time.
 */
export async function sendScheduledNotifications(): Promise<void> {
  await sendMorningNotifications();
  await sendEveningNotifications();
  await sendDueSoonNotifications();
  await sendOverdueNotifications();
}