import { Router } from 'express';
import { AnalyticsPeriod, getProductivityAnalytics } from '../services/analytics';
import { authenticateToken } from '../middleware/auth';
import { analyticsQueryValidation, createFocusSessionValidation } from '../middleware/validation';
import { logger } from '../utils/logger';
import { prisma } from '../prisma';

const router = Router();



/**
 * @swagger
 * /analytics/productivity:
 *   get:
 *     tags: [Analytics]
 *     summary: Get productivity analytics for the current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Productivity analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductivityAnalyticsResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/analytics/productivity', authenticateToken, analyticsQueryValidation, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const rawStartDate = typeof req.query?.startDate === 'string' ? req.query.startDate : undefined;
    const rawEndDate = typeof req.query?.endDate === 'string' ? req.query.endDate : undefined;
    const rawPeriod = typeof req.query?.period === 'string' ? req.query.period : undefined;

    const startDate = rawStartDate ? new Date(rawStartDate) : undefined;
    const endDate = rawEndDate ? new Date(rawEndDate) : undefined;
    const period: AnalyticsPeriod | undefined = rawPeriod === 'week' ? 'week' : rawPeriod === 'day' ? 'day' : undefined;

    const analytics = await getProductivityAnalytics(userId, {
      startDate,
      endDate,
      period,
    });
    return res.json(analytics);
  } catch (error) {
    logger.error('Productivity analytics retrieval failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/analytics/focus-sessions', authenticateToken, createFocusSessionValidation, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      taskId,
      startedAt,
      endedAt,
      plannedDurationSeconds,
      actualDurationSeconds,
      completed,
      interrupted,
    } = req.body;

    const startedAtDate = new Date(startedAt);
    const endedAtDate = new Date(endedAt);

    if (endedAtDate < startedAtDate) {
      return res.status(400).json({ error: 'endedAt must be greater than or equal to startedAt' });
    }

    if (taskId) {
      const task = await prisma.task.findFirst({
        where: {
          id: taskId,
          userId,
        },
        select: { id: true },
      });

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
    }

    const session = await prisma.focusSession.create({
      data: {
        userId,
        taskId: taskId || null,
        startedAt: startedAtDate,
        endedAt: endedAtDate,
        plannedDurationSeconds,
        actualDurationSeconds,
        completed,
        interrupted,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    return res.status(201).json({ session });
  } catch (error) {
    logger.error('Focus session analytics write failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;