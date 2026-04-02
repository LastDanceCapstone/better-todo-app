// src/routes/analytics.ts
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';

const router = Router();

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

/** UTC date key YYYY-MM-DD */
function utcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * GET /api/analytics
 * Query: days (default 30, max 365) — length of "completed over time" series
 */
router.get('/analytics', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const daysParam = Number(req.query.days);
    const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(Math.floor(daysParam), 365) : 30;

    const tasks = await prisma.task.findMany({
      where: { userId },
      select: {
        status: true,
        priority: true,
        completedAt: true,
        createdAt: true,
      },
    });

    const completedWithDate = tasks.filter((t) => t.status === 'COMPLETED' && t.completedAt);

    const now = new Date();
    const completedOverTime: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      dayStart.setUTCDate(dayStart.getUTCDate() - i);
      const key = utcDateKey(dayStart);
      let count = 0;
      for (const t of completedWithDate) {
        if (!t.completedAt) continue;
        if (utcDateKey(new Date(t.completedAt)) === key) {
          count += 1;
        }
      }
      completedOverTime.push({ date: key, count });
    }

    const nonCancelled = tasks.filter((t) => t.status !== 'CANCELLED');
    const completedCount = nonCancelled.filter((t) => t.status === 'COMPLETED').length;
    const totalNonCancelled = nonCancelled.length;
    const rate = totalNonCancelled === 0 ? 0 : completedCount / totalNonCancelled;

    const byPriority: Record<string, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      URGENT: 0,
    };
    for (const t of nonCancelled) {
      byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
    }

    const heatmapDays = 90;
    const heatmap: { date: string; count: number }[] = [];
    for (let i = heatmapDays - 1; i >= 0; i -= 1) {
      const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      dayStart.setUTCDate(dayStart.getUTCDate() - i);
      const key = utcDateKey(dayStart);
      let count = 0;
      for (const t of completedWithDate) {
        if (!t.completedAt) continue;
        if (utcDateKey(new Date(t.completedAt)) === key) {
          count += 1;
        }
      }
      heatmap.push({ date: key, count });
    }

    const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
    const lookback = new Date();
    lookback.setUTCDate(lookback.getUTCDate() - 30);
    for (const t of completedWithDate) {
      if (!t.completedAt) continue;
      const d = new Date(t.completedAt);
      if (d < lookback) continue;
      const wd = d.getUTCDay();
      weekdayCounts[wd] += 1;
    }

    return res.json({
      completedOverTime,
      completionRate: {
        completed: completedCount,
        total: totalNonCancelled,
        rate: Math.round(rate * 1000) / 1000,
        percent: totalNonCancelled === 0 ? 0 : Math.round((completedCount / totalNonCancelled) * 100),
      },
      byPriority,
      heatmap,
      weekdayCompletions: weekdayCounts,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
