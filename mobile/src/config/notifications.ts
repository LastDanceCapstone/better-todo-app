import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// How notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── Request Permission ───────────────────────────────────────────────────────
export const requestNotificationPermission = async (): Promise<boolean> => {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

// ─── Due Date Reminder ────────────────────────────────────────────────────────
// Schedules a notification 1 hour before task due date
export const scheduleDueDateReminder = async (
  taskId: string,
  taskTitle: string,
  dueAt: string
): Promise<string | null> => {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return null;

    const dueDate = new Date(dueAt);
    const reminderTime = new Date(dueDate.getTime() - 60 * 60 * 1000); // 1 hour before

    // Don't schedule if reminder time is in the past
    if (reminderTime <= new Date()) return null;

    // Cancel any existing reminder for this task
    await cancelTaskReminder(taskId);

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏰ Task Due Soon!',
        body: `"${taskTitle}" is due in 1 hour.`,
        data: { taskId },
        sound: true,
      },
      trigger: {
        date: reminderTime,
      },
    });

    return id;
  } catch (error) {
    console.error('Error scheduling due date reminder:', error);
    return null;
  }
};

// ─── Cancel Task Reminder ─────────────────────────────────────────────────────
export const cancelTaskReminder = async (taskId: string): Promise<void> => {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.content.data?.taskId === taskId) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  } catch (error) {
    console.error('Error canceling reminder:', error);
  }
};

// ─── Task Completed Notification ──────────────────────────────────────────────
export const sendTaskCompletedNotification = async (taskTitle: string): Promise<void> => {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '✅ Task Completed!',
        body: `Great job! "${taskTitle}" is done.`,
        sound: true,
      },
      trigger: null, // Send immediately
    });
  } catch (error) {
    console.error('Error sending completion notification:', error);
  }
};

// ─── Daily Reminder ───────────────────────────────────────────────────────────
export const scheduleDailyReminder = async (hour = 9, minute = 0): Promise<string | null> => {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return null;

    // Cancel existing daily reminder first
    await cancelDailyReminder();

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '📋 Daily Check-in',
        body: "Don't forget to check your tasks for today!",
        sound: true,
      },
      trigger: {
        hour,
        minute,
        repeats: true,
      },
    });

    return id;
  } catch (error) {
    console.error('Error scheduling daily reminder:', error);
    return null;
  }
};

// ─── Cancel Daily Reminder ────────────────────────────────────────────────────
export const cancelDailyReminder = async (): Promise<void> => {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.content.title === '📋 Daily Check-in') {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  } catch (error) {
    console.error('Error canceling daily reminder:', error);
  }
};

// ─── Cancel All Notifications ─────────────────────────────────────────────────
export const cancelAllNotifications = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};