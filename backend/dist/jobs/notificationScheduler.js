"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initNotificationScheduler = initNotificationScheduler;
// src/jobs/notificationScheduler.ts
const node_cron_1 = __importDefault(require("node-cron"));
const scheduledNotifications_1 = require("../services/scheduledNotifications");
// Defaults: 08:00 and 20:00 every day (server local time).
// Override via environment variables, e.g.:
//   MORNING_NOTIFICATION_CRON="0 8 * * *"
//   EVENING_NOTIFICATION_CRON="0 20 * * *"
const MORNING_CRON = process.env.MORNING_NOTIFICATION_CRON ?? '0 8 * * *';
const EVENING_CRON = process.env.EVENING_NOTIFICATION_CRON ?? '0 20 * * *';
function initNotificationScheduler() {
    if (!node_cron_1.default.validate(MORNING_CRON)) {
        console.error(`[Scheduler] Invalid MORNING_NOTIFICATION_CRON expression: "${MORNING_CRON}". Morning job will not be scheduled.`);
    }
    else {
        node_cron_1.default.schedule(MORNING_CRON, async () => {
            try {
                await (0, scheduledNotifications_1.sendMorningNotifications)();
            }
            catch (err) {
                console.error('[Scheduler] Unhandled error in Morning Overview job:', err);
            }
        });
    }
    if (!node_cron_1.default.validate(EVENING_CRON)) {
        console.error(`[Scheduler] Invalid EVENING_NOTIFICATION_CRON expression: "${EVENING_CRON}". Evening job will not be scheduled.`);
    }
    else {
        node_cron_1.default.schedule(EVENING_CRON, async () => {
            try {
                await (0, scheduledNotifications_1.sendEveningNotifications)();
            }
            catch (err) {
                console.error('[Scheduler] Unhandled error in Evening Review job:', err);
            }
        });
    }
    console.log('[Scheduler] Notification scheduler initialized');
    console.log(`[Scheduler]  Morning Overview → cron: "${MORNING_CRON}"`);
    console.log(`[Scheduler]  Evening Review   → cron: "${EVENING_CRON}"`);
}
