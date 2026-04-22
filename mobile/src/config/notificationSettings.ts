import {
  getNotificationSettings as fetchNotificationSettings,
  NotificationSettings,
  updateNotificationSettings,
} from './api';

export type { NotificationSettings };

export async function getNotificationSettings(): Promise<NotificationSettings> {
  return fetchNotificationSettings();
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  await updateNotificationSettings(settings);
}
