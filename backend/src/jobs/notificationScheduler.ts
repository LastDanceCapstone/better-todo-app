// src/jobs/notificationScheduler.ts
import cron from 'node-cron';
import {
  sendDueSoonNotifications,
  sendMorningNotifications,
  sendEveningNotifications,
  sendOverdueNotifications,
} from '../services/scheduledNotifications';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// Scheduler runs frequently; each service function applies user-local timing rules.
// Override via environment variables when needed.
const MORNING_CRON = env.MORNING_NOTIFICATION_CRON;
const EVENING_CRON = env.EVENING_NOTIFICATION_CRON;
const DUE_SOON_CRON = env.DUE_SOON_NOTIFICATION_CRON;
const OVERDUE_CRON = env.OVERDUE_NOTIFICATION_CRON;

export function initNotificationScheduler(): void {
  if (!cron.validate(MORNING_CRON)) {
    logger.error(
      `[Scheduler] Invalid MORNING_NOTIFICATION_CRON expression: "${MORNING_CRON}". Morning job will not be scheduled.`,
    );
  } else {
    cron.schedule(MORNING_CRON, async () => {
      try {
        await sendMorningNotifications();
      } catch (err) {
        logger.error('[Scheduler] Unhandled error in Morning Overview job');
      }
    });
  }

  if (!cron.validate(EVENING_CRON)) {
    logger.error(
      `[Scheduler] Invalid EVENING_NOTIFICATION_CRON expression: "${EVENING_CRON}". Evening job will not be scheduled.`,
    );
  } else {
    cron.schedule(EVENING_CRON, async () => {
      try {
        await sendEveningNotifications();
      } catch (err) {
        logger.error('[Scheduler] Unhandled error in Evening Review job');
      }
    });
  }

  if (!cron.validate(DUE_SOON_CRON)) {
    logger.error(
      `[Scheduler] Invalid DUE_SOON_NOTIFICATION_CRON expression: "${DUE_SOON_CRON}". Due Soon job will not be scheduled.`,
    );
  } else {
    cron.schedule(DUE_SOON_CRON, async () => {
      try {
        await sendDueSoonNotifications();
      } catch (err) {
        logger.error('[Scheduler] Unhandled error in Due Soon job');
      }
    });
  }

  if (!cron.validate(OVERDUE_CRON)) {
    logger.error(
      `[Scheduler] Invalid OVERDUE_NOTIFICATION_CRON expression: "${OVERDUE_CRON}". Overdue job will not be scheduled.`,
    );
  } else {
    cron.schedule(OVERDUE_CRON, async () => {
      try {
        await sendOverdueNotifications();
      } catch (err) {
        logger.error('[Scheduler] Unhandled error in Overdue job');
      }
    });
  }

  logger.info('[Scheduler] Notification scheduler initialized');
  logger.info(`[Scheduler]  Morning Overview → cron: "${MORNING_CRON}"`);
  logger.info(`[Scheduler]  Evening Review   → cron: "${EVENING_CRON}"`);
  logger.info(`[Scheduler]  Due Soon         → cron: "${DUE_SOON_CRON}"`);
  logger.info(`[Scheduler]  Overdue          → cron: "${OVERDUE_CRON}"`);
}
