import { prisma } from '../prisma';

type TaskLite = {
  status: string;
  completedAt: Date | null;
  statusChangedAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
};

export type ProductivityAnalytics = {
  completion_rate: number;
  tasks_completed_this_week: number;
  most_productive_hour: string;
  tasks_completed_per_day: Array<{ date: string; count: number }>;
  productivity_trends: Array<{ date: string; completed: number; created: number }>;
  task_categories: Array<{ category: string; count: number; completed: number }>;
  productivity_heatmap: Array<{ day: string; hour: number; count: number }>;
};

const ROLLING_TREND_DAYS = 14;
const COMPLETED_PER_DAY_DAYS = 30;
const WEEKDAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

const startOfUtcDay = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

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

const toWeekdayLabel = (date: Date): string => {
  const day = date.getUTCDay();
  if (day === 0) return 'Sun';
  if (day === 1) return 'Mon';
  if (day === 2) return 'Tue';
  if (day === 3) return 'Wed';
  if (day === 4) return 'Thu';
  if (day === 5) return 'Fri';
  return 'Sat';
};

const isCompletedTask = (task: TaskLite): boolean =>
  task.status === 'COMPLETED' || task.completedAt !== null;

const completionTimestamp = (task: TaskLite): Date | null => {
  if (task.completedAt) return task.completedAt;
  if (task.status === 'COMPLETED') return task.statusChangedAt || task.updatedAt;
  return null;
};

const roundToTwo = (value: number): number => Math.round(value * 100) / 100;

export async function getProductivityAnalytics(userId: string): Promise<ProductivityAnalytics> {
  const tasks = await prisma.task.findMany({
    where: { userId },
    select: {
      status: true,
      completedAt: true,
      statusChangedAt: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(isCompletedTask);
  const completionRate = totalTasks === 0 ? 0 : roundToTwo(completedTasks.length / totalTasks);

  const now = new Date();
  const weekStart = startOfUtcWeekMonday(now);
  const nextWeekStart = addUtcDays(weekStart, 7);

  const completedWithTimestamp = completedTasks
    .map((task) => completionTimestamp(task))
    .filter((timestamp): timestamp is Date => timestamp !== null);

  const tasksCompletedThisWeek = completedWithTimestamp.filter(
    (timestamp) => timestamp >= weekStart && timestamp < nextWeekStart
  ).length;

  const perDayStart = addUtcDays(startOfUtcDay(now), -(COMPLETED_PER_DAY_DAYS - 1));
  const completedPerDayMap = new Map<string, number>();

  completedWithTimestamp.forEach((timestamp) => {
    if (timestamp < perDayStart) return;
    const key = toIsoDate(timestamp);
    completedPerDayMap.set(key, (completedPerDayMap.get(key) || 0) + 1);
  });

  const tasksCompletedPerDay = Array.from(completedPerDayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const trendStart = addUtcDays(startOfUtcDay(now), -(ROLLING_TREND_DAYS - 1));
  const createdByDate = new Map<string, number>();
  const completedByDate = new Map<string, number>();

  tasks.forEach((task) => {
    if (task.createdAt >= trendStart) {
      const key = toIsoDate(task.createdAt);
      createdByDate.set(key, (createdByDate.get(key) || 0) + 1);
    }

    const completedAt = completionTimestamp(task);
    if (completedAt && completedAt >= trendStart) {
      const key = toIsoDate(completedAt);
      completedByDate.set(key, (completedByDate.get(key) || 0) + 1);
    }
  });

  const productivityTrends: Array<{ date: string; completed: number; created: number }> = [];
  for (let i = 0; i < ROLLING_TREND_DAYS; i += 1) {
    const day = addUtcDays(trendStart, i);
    const key = toIsoDate(day);
    productivityTrends.push({
      date: key,
      completed: completedByDate.get(key) || 0,
      created: createdByDate.get(key) || 0,
    });
  }

  const hourCounts = new Array<number>(24).fill(0);
  completedWithTimestamp.forEach((timestamp) => {
    hourCounts[timestamp.getUTCHours()] += 1;
  });

  let topHour = 0;
  let topHourCount = 0;
  for (let hour = 0; hour < hourCounts.length; hour += 1) {
    if (hourCounts[hour] > topHourCount) {
      topHourCount = hourCounts[hour];
      topHour = hour;
    }
  }
  const mostProductiveHour = `${String(topHour).padStart(2, '0')}:00`;

  const completedCount = completedTasks.length;
  const taskCategories = totalTasks === 0
    ? []
    : [{ category: 'Uncategorized', count: totalTasks, completed: completedCount }];

  const heatmapCounter = new Map<string, number>();
  completedWithTimestamp.forEach((timestamp) => {
    const day = toWeekdayLabel(timestamp);
    const hour = timestamp.getUTCHours();
    const key = `${day}-${hour}`;
    heatmapCounter.set(key, (heatmapCounter.get(key) || 0) + 1);
  });

  const productivityHeatmap = Array.from(heatmapCounter.entries())
    .map(([key, count]) => {
      const [day, hourString] = key.split('-');
      return { day, hour: Number(hourString), count };
    })
    .sort((a, b) => {
      const dayDiff = WEEKDAY_ORDER.indexOf(a.day) - WEEKDAY_ORDER.indexOf(b.day);
      if (dayDiff !== 0) return dayDiff;
      return a.hour - b.hour;
    });

  return {
    completion_rate: completionRate,
    tasks_completed_this_week: tasksCompletedThisWeek,
    most_productive_hour: mostProductiveHour,
    tasks_completed_per_day: tasksCompletedPerDay,
    productivity_trends: productivityTrends,
    task_categories: taskCategories,
    productivity_heatmap: productivityHeatmap,
  };
}