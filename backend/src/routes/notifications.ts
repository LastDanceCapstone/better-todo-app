// src/routes/notifications.ts
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { NotificationType } from '@prisma/client';
import {
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
} from '../services/notifications';

const router = Router();

const VALID_NOTIFICATION_TYPES = new Set<string>(Object.values(NotificationType));

const serializeNotification = (n: any) => ({
  ...n,
  createdAt: n.createdAt ? n.createdAt.toISOString() : null,
  readAt: n.readAt ? n.readAt.toISOString() : null,
});

// Auth middleware (same pattern as tasks.ts)
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET!, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

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
 *               type: object
 *               properties:
 *                 notifications:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Notification'
 *       401:
 *         description: Unauthorized
 */
router.get('/notifications', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const notifications = await getUserNotifications(userId);
    return res.json({ notifications: notifications.map(serializeNotification) });
  } catch (error) {
    console.error('GET /notifications error:', error);
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
 *             type: object
 *             required:
 *               - type
 *               - title
 *               - message
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [TASK_DUE_SOON, TASK_OVERDUE, MORNING_OVERVIEW, EVENING_REVIEW]
 *               title:
 *                 type: string
 *                 example: Task due soon
 *               message:
 *                 type: string
 *                 example: "Your task 'Sprint Review' is due in 1 hour."
 *     responses:
 *       201:
 *         description: Notification created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/notifications', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { type, title, message } = req.body;

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

    const notification = await createNotification(
      userId,
      type as NotificationType,
      title.trim(),
      message.trim(),
    );

    return res.status(201).json({ notification: serializeNotification(notification) });
  } catch (error) {
    console.error('POST /notifications error:', error);
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
 *       403:
 *         description: Forbidden — notification belongs to another user
 *       404:
 *         description: Notification not found
 *       401:
 *         description: Unauthorized
 */
router.patch('/notifications/:id/read', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;

    const result = await markNotificationAsRead(id, userId);

    if (result === null) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (result === 'forbidden') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return res.json({ notification: serializeNotification(result) });
  } catch (error) {
    console.error('PATCH /notifications/:id/read error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
