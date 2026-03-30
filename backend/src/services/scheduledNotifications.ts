import { prisma } from '../prisma';
import { createNotification } from './notifications';
import { NotificationType } from '@prisma/client';

/**
 * Returns all users in the system.
 */
export async function getAllUsers() {
  return prisma.user.findMany({ select: { id: true, firstName: true } });
}

/**
 * Returns all tasks due today for a user.
 */
export async function getTasksDueToday(userId: string, today: Date) {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);
  return prisma.task.findMany({
    where: {
      userId,
      dueAt: { gte: start, lte: end },
    },
  });
}

/**
 * Returns all incomplete tasks for a user.
 */
export async function getIncompleteTasks(userId: string) {
  return prisma.task.findMany({
    where: {
      userId,
      status: { in: ['TODO', 'IN_PROGRESS'] },
    },
  });
}

/**
 * Schedules and sends morning and evening notifications for all users.
 * This should be called by a scheduler (e.g., node-cron).
 */
export async function sendScheduledNotifications() {
  const users = await getAllUsers();
  const today = new Date();

  for (const user of users) {
    // Morning notification
    const dueTasks = await getTasksDueToday(user.id, today);
    await createNotification(
      user.id,
      NotificationType.MORNING_OVERVIEW,
      `Good morning${user.firstName ? ' ' + user.firstName : ''}!`,
      `You have ${dueTasks.length} task${dueTasks.length === 1 ? '' : 's'} due today.`
    );

    // Evening notification
    const incompleteTasks = await getIncompleteTasks(user.id);
    await createNotification(
      user.id,
      NotificationType.EVENING_REVIEW,
      'Evening Review',
      `${incompleteTasks.length} task${incompleteTasks.length === 1 ? '' : 's'} still remaining today.`
    );
  }
}
