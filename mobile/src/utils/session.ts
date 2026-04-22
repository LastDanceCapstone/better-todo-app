import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteAuthToken } from './authStorage';

const AUTH_USER_STORAGE_KEY = 'user';
const USER_AVATAR_CACHE_KEY = 'userAvatar';
const APP_CALENDAR_SYNC_ENABLED_KEY = 'prioritizeCalendarAppSyncEnabled';

export async function clearLocalAuthSession(): Promise<void> {
  await deleteAuthToken();
  if (typeof AsyncStorage.multiRemove === 'function') {
    await AsyncStorage.multiRemove([
      AUTH_USER_STORAGE_KEY,
      USER_AVATAR_CACHE_KEY,
      APP_CALENDAR_SYNC_ENABLED_KEY,
    ]);
    return;
  }

  await Promise.all([
    AsyncStorage.removeItem(AUTH_USER_STORAGE_KEY),
    AsyncStorage.removeItem(USER_AVATAR_CACHE_KEY),
    AsyncStorage.removeItem(APP_CALENDAR_SYNC_ENABLED_KEY),
  ]);
}
