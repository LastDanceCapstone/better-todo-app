import { prisma } from '../prisma';

export type AnalyticsPeriod = 'day' | 'week';

export type AnalyticsQueryOptions = {
  startDate?: Date;
  endDate?: Date;
  period?: AnalyticsPeriod;
};

type TaskForCompletion = {
  status: string;
  createdAt: Date;
  dueAt: Date | null;
  completedAt: Date | null;
  statusChangedAt: Date | null;
  updatedAt: Date;
};

export type AnalyticsResponse = {
  range: {
    startDate: string;
    endDate: string;
    period: AnalyticsPeriod;
  };
  overview: {
    totalCreated: number;
    totalCompleted: number;
    completionRate: number;
  };
  tasksByStatus: {
    TODO: number;
    IN_PROGRESS: number;
    COMPLETED: number;
    CANCELLED: number;
  };
  tasksByPriority: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    URGENT: number;
  };
  trends: {
    created: Array<{ periodStart: string; label: string; count: number }>;
    completed: Array<{ periodStart: string; label: string; count: number }>;
  };
  productivity: {
    avgCompletionTimeHours: number | null;
    tasksCompletedInRange: number;
    tasksPerPeriod: Array<{ periodStart: string; label: string; count: number }>;
  };
  overdue: {
    overdueCount: number;
    onTimeCount: number;
    lateCount: number;
  };
};

const DEFAULT_RANGE_DAYS = 30;

const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

const startOfUtcDay = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const endOfUtcDay = (date: Date): Date => {
  const value = startOfUtcDay(date);
  value.setUTCDate(value.getUTCDate() + 1);
  value.setUTCMilliseconds(-1);
  return value;
};

const addUtcDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const startOfUtcWeekMonday = (date: Date): Date => {
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return startOfUtcDay(addUtcDays(date, diff));
};

const roundToOne = (value: number): number => Math.round(value * 10) / 10;

const completionTimestamp = (task: TaskForCompletion): Date | null => {
  if (task.completedAt) return task.completedAt;
  if (task.status === 'COMPLETED') return task.statusChangedAt || task.updatedAt;
  return null;
};

const resolveDateRange = (options: AnalyticsQueryOptions): {
  startDate: Date;
  endDate: Date;
  period: AnalyticsPeriod;
} => {
  const period = options.period || 'day';
  const now = new Date();

  const resolvedEnd = options.endDate ? endOfUtcDay(options.endDate) : endOfUtcDay(now);
  let resolvedStart: Date;

  if (options.startDate) {
    resolvedStart = startOfUtcDay(options.startDate);
  } else {
    resolvedStart = startOfUtcDay(addUtcDays(resolvedEnd, -(DEFAULT_RANGE_DAYS - 1)));
  }

  if (resolvedStart > resolvedEnd) {
    const fallbackStart = startOfUtcDay(addUtcDays(resolvedEnd, -(DEFAULT_RANGE_DAYS - 1)));
    return {
      startDate: fallbackStart,
      endDate: resolvedEnd,
      period,
    };
  }

  return {
    startDate: resolvedStart,
    endDate: resolvedEnd,
    period,
  };
};

const buildPeriodBuckets = (startDate: Date, endDate: Date, period: AnalyticsPeriod): Array<{ periodStart: string; label: string }> => {
  const buckets: Array<{ periodStart: string; label: string }> = [];

  if (period === 'week') {
    let cursor = startOfUtcWeekMonday(startDate);
    while (cursor <= endDate) {
      const key = toIsoDate(cursor);
      const label = `Wk of ${cursor.getUTCMonth() + 1}/${cursor.getUTCDate()}`;
      buckets.push({ periodStart: key, label });
      cursor = addUtcDays(cursor, 7);
    }
    return buckets;
  }

  let cursor = startOfUtcDay(startDate);
  while (cursor <= endDate) {
    const key = toIsoDate(cursor);
    const label = `${cursor.getUTCMonth() + 1}/${cursor.getUTCDate()}`;
    buckets.push({ periodStart: key, label });
    cursor = addUtcDays(cursor, 1);
  }

  return buckets;
};

const bucketKeyForDate = (date: Date, period: AnalyticsPeriod): string => {
  if (period === 'week') {
    return toIsoDate(startOfUtcWeekMonday(date));
  }
  return toIsoDate(startOfUtcDay(date));
};

export async function getProductivityAnalytics(
  userId: string,
  options: AnalyticsQueryOptions = {}
): Promise<AnalyticsResponse> {
  const { startDate, endDate, period } = resolveDateRange(options);
  const now = new Date();

  const [createdTasks, completedCandidates, overdueCount] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        status: true,
        priority: true,
        createdAt: true,
      },
    }),
    prisma.task.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        OR: [
          {
            completedAt: {
              not: null,
              gte: startDate,
              lte: endDate,
            },
          },
          {
            completedAt: null,
            statusChangedAt: {
              not: null,
              gte: startDate,
              lte: endDate,
            },
          },
          {
            completedAt: null,
            statusChangedAt: null,
            updatedAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        ],
      },
      select: {
        status: true,
        createdAt: true,
        dueAt: true,
        completedAt: true,
        statusChangedAt: true,
        updatedAt: true,
      },
    }),
    prisma.task.count({
      where: {
        userId,
        dueAt: {
          lt: now,
        },
        status: {
          in: ['TODO', 'IN_PROGRESS'],
        },
      },
    }),
  ]);

  const tasksByStatus: AnalyticsResponse['tasksByStatus'] = {
    TODO: 0,
    IN_PROGRESS: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  };

  const tasksByPriority: AnalyticsResponse['tasksByPriority'] = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    URGENT: 0,
  };

  const createdCounter = new Map<string, number>();
  createdTasks.forEach((task) => {
    tasksByStatus[task.status] += 1;
    tasksByPriority[task.priority] += 1;

    const key = bucketKeyForDate(task.createdAt, period);
    createdCounter.set(key, (createdCounter.get(key) || 0) + 1);
  });

  const completedCounter = new Map<string, number>();
  let onTimeCount = 0;
  let lateCount = 0;
  let completionTimeTotalHours = 0;
  let completionTimeSampleCount = 0;

  completedCandidates.forEach((task) => {
    const completedAt = completionTimestamp(task);
    if (!completedAt) return;

    const key = bucketKeyForDate(completedAt, period);
    completedCounter.set(key, (completedCounter.get(key) || 0) + 1);

    const durationMs = completedAt.getTime() - task.createdAt.getTime();
    if (durationMs >= 0) {
      completionTimeTotalHours += durationMs / (1000 * 60 * 60);
      completionTimeSampleCount += 1;
    }

    if (task.dueAt) {
      if (completedAt <= task.dueAt) {
        onTimeCount += 1;
      } else {
        lateCount += 1;
      }
    }
  });

  const buckets = buildPeriodBuckets(startDate, endDate, period);
  const createdTrend = buckets.map((bucket) => ({
    periodStart: bucket.periodStart,
    label: bucket.label,
    count: createdCounter.get(bucket.periodStart) || 0,
  }));
  const completedTrend = buckets.map((bucket) => ({
    periodStart: bucket.periodStart,
    label: bucket.label,
    count: completedCounter.get(bucket.periodStart) || 0,
  }));

  const totalCreated = createdTasks.length;
  const totalCompleted = tasksByStatus.COMPLETED;
  const completionRate = totalCreated === 0 ? 0 : roundToOne((totalCompleted / totalCreated) * 100);

  const avgCompletionTimeHours =
    completionTimeSampleCount === 0
      ? null
      : roundToOne(completionTimeTotalHours / completionTimeSampleCount);

  return {
    range: {
      startDate: toIsoDate(startDate),
      endDate: toIsoDate(endDate),
      period,
    },
    overview: {
      totalCreated,
      totalCompleted,
      completionRate,
    },
    tasksByStatus,
    tasksByPriority,
    trends: {
      created: createdTrend,
      completed: completedTrend,
    },
    productivity: {
      avgCompletionTimeHours,
      tasksCompletedInRange: completedCandidates.length,
      tasksPerPeriod: completedTrend,
    },
    overdue: {
      overdueCount,
      onTimeCount,
      lateCount,
    },
  };
}