"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasNotificationOfTypeForUserToday = exports.markNotificationAsRead = exports.getUserNotifications = exports.createNotification = void 0;
const prisma_1 = require("../prisma");
const createNotification = async (userId, type, title, message) => {
    return prisma_1.prisma.notification.create({
        data: { userId, type, title, message },
    });
};
exports.createNotification = createNotification;
const getUserNotifications = async (userId) => {
    return prisma_1.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
    });
};
exports.getUserNotifications = getUserNotifications;
const markNotificationAsRead = async (notificationId, userId) => {
    // Verify the notification belongs to the requesting user before updating
    const notification = await prisma_1.prisma.notification.findUnique({
        where: { id: notificationId },
    });
    if (!notification)
        return null;
    if (notification.userId !== userId)
        return 'forbidden';
    if (notification.isRead)
        return notification; // already read — no-op
    return prisma_1.prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true, readAt: new Date() },
    });
};
exports.markNotificationAsRead = markNotificationAsRead;
/**
 * Returns true if a notification of the given type has already been created
 * for the user on the current calendar day (UTC). Used for duplicate prevention
 * in scheduled jobs.
 */
const hasNotificationOfTypeForUserToday = async (userId, type) => {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date();
    end.setUTCHours(23, 59, 59, 999);
    const existing = await prisma_1.prisma.notification.findFirst({
        where: {
            userId,
            type,
            createdAt: { gte: start, lte: end },
        },
    });
    return existing !== null;
};
exports.hasNotificationOfTypeForUserToday = hasNotificationOfTypeForUserToday;
