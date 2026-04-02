import AsyncStorage from '@react-native-async-storage/async-storage';

export interface NotificationSettings {
  morningOverview: boolean;
  eveningReview: boolean;
  taskDueReminders: boolean;
  overdueTaskAlerts: boolean;
}

interface StoredUser {
  id?: string;
  email?: string;
}

const SETTINGS_KEY_PREFIX = 'notificationSettings';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  morningOverview: true,
  eveningReview: true,
  taskDueReminders: true,
  overdueTaskAlerts: true,
};

export async function getStoredAuthUser(): Promise<StoredUser | null> {
  const raw = await AsyncStorage.getItem('user');
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function getNotificationSettingsStorageKey(user: StoredUser | null): string {
  const identity = user?.id || user?.email || 'anonymous';
  return `${SETTINGS_KEY_PREFIX}:${identity}`;
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const user = await getStoredAuthUser();
  const storageKey = getNotificationSettingsStorageKey(user);
  const raw = await AsyncStorage.getItem(storageKey);

  if (!raw) {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<NotificationSettings>;
    return {
      morningOverview: parsed.morningOverview ?? DEFAULT_NOTIFICATION_SETTINGS.morningOverview,
      eveningReview: parsed.eveningReview ?? DEFAULT_NOTIFICATION_SETTINGS.eveningReview,
      taskDueReminders: parsed.taskDueReminders ?? DEFAULT_NOTIFICATION_SETTINGS.taskDueReminders,
      overdueTaskAlerts: parsed.overdueTaskAlerts ?? DEFAULT_NOTIFICATION_SETTINGS.overdueTaskAlerts,
    };
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  const user = await getStoredAuthUser();
  const storageKey = getNotificationSettingsStorageKey(user);
  await AsyncStorage.setItem(storageKey, JSON.stringify(settings));
}
