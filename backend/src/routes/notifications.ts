// src/routes/notifications.ts
import { Router } from 'express';
import { DevicePlatform, NotificationType } from '@prisma/client';
import {
  createNotification,
  getUnreadNotificationCount,
  getNotificationSettings,
  getUserNotifications,
  markNotificationAsRead,
  updateNotificationSettings,
} from '../services/notifications';
import { authenticateToken } from '../middleware/auth';
import {
  createNotificationValidation,
  noQueryValidation,
  notificationIdParamValidation,
  registerPushDeviceValidation,
  unregisterPushDeviceValidation,
  updateNotificationSettingsValidation,
} from '../middleware/validation';
import { prisma } from '../prisma';
import { logger } from '../utils/logger';
import { sendPushForNotification } from '../services/pushDelivery';
import { isValidTimeZone } from '../utils/timezone';

const router = Router();

const VALID_NOTIFICATION_TYPES = new Set<string>(Object.values(NotificationType));

const serializeNotification = (n: any) => ({
  ...n,
  taskId: n.taskId ?? null,
  createdAt: n.createdAt ? n.createdAt.toISOString() : null,
  readAt: n.readAt ? n.readAt.toISOString() : null,
});

const serializePushDevice = (device: any) => ({
  id: device.id,
  installationId: device.installationId,
  expoPushToken: device.expoPushToken,
  platform: device.platform === DevicePlatform.IOS ? 'ios' : 'android',
  deviceName: device.deviceName ?? null,
  appVersion: device.appVersion ?? null,
  createdAt: device.createdAt?.toISOString?.() ?? null,
  updatedAt: device.updatedAt?.toISOString?.() ?? null,
  lastRegisteredAt: device.lastRegisteredAt?.toISOString?.() ?? null,
});



/**
 * @swagger
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Get all notifications for the current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationListResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/notifications', authenticateToken, noQueryValidation, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const notifications = await getUserNotifications(userId);
    return res.json({ notifications: notifications.map(serializeNotification) });
  } catch (error) {
    logger.error('Notifications retrieval failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Get unread notification count for the current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 unreadCount:
 *                   type: integer
 *                   example: 3
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/notifications/unread-count', authenticateToken, noQueryValidation, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const unreadCount = await getUnreadNotificationCount(userId);
    return res.json({ unreadCount });
  } catch (error) {
    logger.error('Unread notification count retrieval failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /notifications:
 *   post:
 *     tags: [Notifications]
 *     summary: Create a notification for the current user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NotificationCreateRequest'
 *     responses:
 *       201:
 *         description: Notification created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/notifications', authenticateToken, createNotificationValidation, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { type, title, message, taskId } = req.body;

    if (!type || typeof type !== 'string' || !VALID_NOTIFICATION_TYPES.has(type)) {
      return res.status(400).json({
        error: `Field "type" is required and must be one of: ${[...VALID_NOTIFICATION_TYPES].join(', ')}`,
      });
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Field "title" is required and must be a non-empty string' });
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Field "message" is required and must be a non-empty string' });
    }

    const { notification } = await createNotification(
      userId,
      type as NotificationType,
      title.trim(),
      message.trim(),
      { taskId: taskId ?? null },
    );

    // Best effort: API success should not depend on push transport health.
    void sendPushForNotification(
      userId,
      type as NotificationType,
      title.trim(),
      message.trim(),
      {
        taskId: taskId ?? null,
        notificationId: notification.id,
      },
    ).catch(() => {
      logger.warn('Push delivery failed for manual notification');
    });

    return res.status(201).json({ notification: serializeNotification(notification) });
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && (error as { code?: string }).code === 'TASK_NOT_FOUND_OR_FORBIDDEN') {
      return res.status(400).json({ error: 'taskId must reference an existing task you own' });
    }
    logger.error('Notification creation failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /notification-settings:
 *   get:
 *     tags: [Notifications]
 *     summary: Get notification settings for the current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 settings:
 *                   type: object
 *                   properties:
 *                     morningOverview:
 *                       type: boolean
 *                     eveningReview:
 *                       type: boolean
 *                     dueSoonNotifications:
 *                       type: boolean
 *                     overdueNotifications:
 *                       type: boolean
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/notification-settings', authenticateToken, noQueryValidation, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const settings = await getNotificationSettings(userId);
    return res.json({ settings });
  } catch (error) {
    logger.error('Notification settings retrieval failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /notification-settings:
 *   patch:
 *     tags: [Notifications]
 *     summary: Update notification settings for the current user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               morningOverview:
 *                 type: boolean
 *               eveningReview:
 *                 type: boolean
 *               dueSoonNotifications:
 *                 type: boolean
 *               overdueNotifications:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Notification settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 settings:
 *                   type: object
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch('/notification-settings', authenticateToken, updateNotificationSettingsValidation, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const settings = await updateNotificationSettings(userId, req.body);
    return res.json({ settings });
  } catch (error) {
    logger.error('Notification settings update failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /notification-devices/register:
 *   post:
 *     tags: [Notifications]
 *     summary: Register or refresh push notification device for the current user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - installationId
 *               - expoPushToken
 *               - platform
 *             properties:
 *               installationId:
 *                 type: string
 *               expoPushToken:
 *                 type: string
 *               platform:
 *                 type: string
 *                 enum: [ios, android]
 *               deviceName:
 *                 type: string
 *               appVersion:
 *                 type: string
 *     responses:
 *       201:
 *         description: Push device registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 device:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     installationId:
 *                       type: string
 *                     expoPushToken:
 *                       type: string
 *                     platform:
 *                       type: string
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/notification-devices/register', authenticateToken, registerPushDeviceValidation, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      installationId,
      expoPushToken,
      platform,
      deviceName,
      appVersion,
      timezone,
    } = req.body as {
      installationId: string;
      expoPushToken: string;
      platform: 'ios' | 'android';
      deviceName?: string;
      appVersion?: string;
      timezone?: string;
    };

    const normalizedTimeZone = typeof timezone === 'string' ? timezone.trim() : '';
    if (normalizedTimeZone && !isValidTimeZone(normalizedTimeZone)) {
      return res.status(400).json({ error: 'timezone must be a valid IANA timezone string' });
    }

    await prisma.pushDevice.deleteMany({
      where: {
        expoPushToken,
        installationId: { not: installationId },
      },
    });

    const device = await prisma.pushDevice.upsert({
      where: { installationId },
      update: {
        userId,
        expoPushToken,
        platform: platform === 'ios' ? DevicePlatform.IOS : DevicePlatform.ANDROID,
        deviceName: deviceName ?? null,
        appVersion: appVersion ?? null,
        lastRegisteredAt: new Date(),
      },
      create: {
        userId,
        installationId,
        expoPushToken,
        platform: platform === 'ios' ? DevicePlatform.IOS : DevicePlatform.ANDROID,
        deviceName: deviceName ?? null,
        appVersion: appVersion ?? null,
      },
    });

    if (normalizedTimeZone) {
      await prisma.user.update({
        where: { id: userId },
        data: { timezone: normalizedTimeZone },
      });
    }

    return res.status(201).json({ device: serializePushDevice(device) });
  } catch (error) {
    logger.error('Push device registration failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /notification-devices/unregister:
 *   post:
 *     tags: [Notifications]
 *     summary: Unregister push notification device for the current user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - installationId
 *             properties:
 *               installationId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Push device unregistered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/notification-devices/unregister', authenticateToken, unregisterPushDeviceValidation, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { installationId } = req.body as { installationId: string };

    await prisma.pushDevice.deleteMany({
      where: {
        userId,
        installationId,
      },
    });

    return res.json({ success: true });
  } catch (error) {
    logger.error('Push device unregistration failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark a notification as read
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationResponse'
 *       403:
 *         description: Forbidden — notification belongs to another user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Notification not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch('/notifications/:id/read', authenticateToken, notificationIdParamValidation, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;

    const result = await markNotificationAsRead(id, userId);

    if (result === null) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    return res.json({ notification: serializeNotification(result) });
  } catch (error) {
    logger.error('Notification read update failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
