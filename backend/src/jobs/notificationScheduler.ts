// src/jobs/notificationScheduler.ts
import cron from 'node-cron';
import {
  sendMorningNotifications,
  sendEveningNotifications,
} from '../services/scheduledNotifications';

// Defaults: 08:00 and 20:00 every day (server local time).
// Override via environment variables, e.g.:
//   MORNING_NOTIFICATION_CRON="0 8 * * *"
//   EVENING_NOTIFICATION_CRON="0 20 * * *"
const MORNING_CRON = process.env.MORNING_NOTIFICATION_CRON ?? '0 8 * * *';
const EVENING_CRON = process.env.EVENING_NOTIFICATION_CRON ?? '0 20 * * *';

export function initNotificationScheduler(): void {
  if (!cron.validate(MORNING_CRON)) {
    console.error(
      `[Scheduler] Invalid MORNING_NOTIFICATION_CRON expression: "${MORNING_CRON}". Morning job will not be scheduled.`,
    );
  } else {
    cron.schedule(MORNING_CRON, async () => {
      try {
        await sendMorningNotifications();
      } catch (err) {
        console.error('[Scheduler] Unhandled error in Morning Overview job:', err);
      }
    });
  }

  if (!cron.validate(EVENING_CRON)) {
    console.error(
      `[Scheduler] Invalid EVENING_NOTIFICATION_CRON expression: "${EVENING_CRON}". Evening job will not be scheduled.`,
    );
  } else {
    cron.schedule(EVENING_CRON, async () => {
      try {
        await sendEveningNotifications();
      } catch (err) {
        console.error('[Scheduler] Unhandled error in Evening Review job:', err);
      }
    });
  }

  console.log('[Scheduler] Notification scheduler initialized');
  console.log(`[Scheduler]  Morning Overview → cron: "${MORNING_CRON}"`);
  console.log(`[Scheduler]  Evening Review   → cron: "${EVENING_CRON}"`);
}
