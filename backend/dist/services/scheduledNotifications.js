"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllUsers = getAllUsers;
exports.getTasksDueToday = getTasksDueToday;
exports.getIncompleteTasks = getIncompleteTasks;
exports.sendMorningNotifications = sendMorningNotifications;
exports.sendEveningNotifications = sendEveningNotifications;
exports.sendScheduledNotifications = sendScheduledNotifications;
const prisma_1 = require("../prisma");
const notifications_1 = require("./notifications");
const client_1 = require("@prisma/client");
/**
 * Returns all users in the system.
 */
async function getAllUsers() {
    return prisma_1.prisma.user.findMany({ select: { id: true, firstName: true } });
}
/**
 * Returns all tasks due today for a user.
 */
async function getTasksDueToday(userId, today) {
    const start = new Date(today);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setUTCHours(23, 59, 59, 999);
    return prisma_1.prisma.task.findMany({
        where: {
            userId,
            dueAt: { gte: start, lte: end },
        },
    });
}
/**
 * Returns all incomplete tasks for a user.
 */
async function getIncompleteTasks(userId) {
    return prisma_1.prisma.task.findMany({
        where: {
            userId,
            status: { in: ['TODO', 'IN_PROGRESS'] },
        },
    });
}
/**
 * Sends Morning Overview notifications to all users.
 * Skips users who already received one today (duplicate prevention).
 */
async function sendMorningNotifications() {
    console.log('[Scheduler] Morning Overview job started');
    const users = await getAllUsers();
    const today = new Date();
    let created = 0;
    let skipped = 0;
    for (const user of users) {
        try {
            const alreadySent = await (0, notifications_1.hasNotificationOfTypeForUserToday)(user.id, client_1.NotificationType.MORNING_OVERVIEW);
            if (alreadySent) {
                skipped++;
                continue;
            }
            const dueTasks = await getTasksDueToday(user.id, today);
            await (0, notifications_1.createNotification)(user.id, client_1.NotificationType.MORNING_OVERVIEW, `Good morning${user.firstName ? ', ' + user.firstName : ''}!`, `You have ${dueTasks.length} task${dueTasks.length === 1 ? '' : 's'} due today.`);
            created++;
        }
        catch (err) {
            console.error(`[Scheduler] Failed MORNING_OVERVIEW for user ${user.id}:`, err);
        }
    }
    console.log(`[Scheduler] Morning Overview job finished — created: ${created}, skipped (duplicate): ${skipped}`);
}
/**
 * Sends Evening Review notifications to all users.
 * Skips users who already received one today (duplicate prevention).
 */
async function sendEveningNotifications() {
    console.log('[Scheduler] Evening Review job started');
    const users = await getAllUsers();
    let created = 0;
    let skipped = 0;
    for (const user of users) {
        try {
            const alreadySent = await (0, notifications_1.hasNotificationOfTypeForUserToday)(user.id, client_1.NotificationType.EVENING_REVIEW);
            if (alreadySent) {
                skipped++;
                continue;
            }
            const incompleteTasks = await getIncompleteTasks(user.id);
            await (0, notifications_1.createNotification)(user.id, client_1.NotificationType.EVENING_REVIEW, 'Evening Review', `${incompleteTasks.length} task${incompleteTasks.length === 1 ? '' : 's'} still remaining today. Take a moment to review them.`);
            created++;
        }
        catch (err) {
            console.error(`[Scheduler] Failed EVENING_REVIEW for user ${user.id}:`, err);
        }
    }
    console.log(`[Scheduler] Evening Review job finished — created: ${created}, skipped (duplicate): ${skipped}`);
}
/**
 * Convenience wrapper that runs morning and evening jobs sequentially.
 * @deprecated Prefer calling sendMorningNotifications() and sendEveningNotifications()
 * directly via the scheduler so each runs at its configured time.
 */
async function sendScheduledNotifications() {
    await sendMorningNotifications();
    await sendEveningNotifications();
}
