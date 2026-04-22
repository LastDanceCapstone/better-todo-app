import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { getUserFriendlyErrorMessage } from '../config/api';
import { handleUnauthorizedIfNeeded } from '../auth/unauthorizedHandler';
import {
  getNotificationSettings,
  NotificationSettings,
  saveNotificationSettings,
} from '../config/notificationSettings';
import { logger } from '../utils/logger';
import {
  getNotificationPermissionState,
  NotificationPermissionState,
  syncPushNotificationRegistration,
} from '../services/pushNotifications';

type NotificationSettingKey = keyof NotificationSettings;

interface SettingItem {
  key: NotificationSettingKey;
  label: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}

const SETTING_ITEMS: SettingItem[] = [
  {
    key: 'pushEnabled',
    label: 'Push Alerts',
    description: 'Deliver notification events as iPhone push alerts when device permission is granted.',
    icon: 'notifications-active',
  },
  {
    key: 'morningOverview',
    label: 'Morning Overview',
    description: 'Receive a morning summary of tasks due today.',
    icon: 'wb-sunny',
  },
  {
    key: 'eveningReview',
    label: 'Evening Review',
    description: 'Receive an evening reminder of tasks still incomplete.',
    icon: 'nights-stay',
  },
  {
    key: 'dueSoonNotifications',
    label: 'Task Due Reminders',
    description: 'Get notified when tasks are approaching their due time.',
    icon: 'schedule',
  },
  {
    key: 'overdueNotifications',
    label: 'Overdue Task Alerts',
    description: 'Get notified when tasks become overdue.',
    icon: 'warning',
  },
];

export default function NotificationSettingsScreen({ navigation, onSessionExpired }: any) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionState>('undetermined');
  const [syncingDevice, setSyncingDevice] = useState(false);

  // Ref guard prevents two concurrent loadSettings calls — most commonly caused by
  // useFocusEffect + useEffect both firing on the initial mount (now fixed: useEffect
  // removed, but the ref stays as an extra safety net for rapid focus events).
  const loadingRef = useRef(false);

  const loadSettings = useCallback(async () => {
    // Guard: prevent concurrent invocations (e.g. useEffect + useFocusEffect firing simultaneously on mount)
    if (loadingRef.current) {
      return;
    }
    loadingRef.current = true;
    setLoading(true);
    try {
      const loaded = await getNotificationSettings();
      setSettings(loaded);

      // Read-only permission check only — no token fetch, no backend registration call.
      // Full syncPushNotificationRegistration is reserved for the manual "Refresh" button
      // so that a transient registration failure never blocks settings from loading.
      const permState = await getNotificationPermissionState();
      setPermissionStatus(permState);
    } catch (error) {
      if (await handleUnauthorizedIfNeeded({ error, source: 'NotificationSettings.loadSettings', onSessionExpired })) {
        return;
      }

      logger.warn('Failed to load notification settings');
      Alert.alert('Error', 'Failed to load notification settings. Please try again.');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [onSessionExpired]);

  // useFocusEffect covers both initial mount and returning to this screen.
  // The duplicate useEffect has been removed — it was firing a second concurrent
  // call on every mount, racing with useFocusEffect and causing the loading
  // spinner to flash twice and potentially show two simultaneous alerts.
  useFocusEffect(
    useCallback(() => {
      void loadSettings();
    }, [loadSettings])
  );

  const updateSetting = useCallback(async (key: NotificationSettingKey, value: boolean) => {
    if (!settings) return;

    const nextSettings: NotificationSettings = {
      ...settings,
      [key]: value,
    };

    setSettings(nextSettings);

    try {
      await saveNotificationSettings(nextSettings);
    } catch (error) {
      if (await handleUnauthorizedIfNeeded({ error, source: 'NotificationSettings.updateSetting', onSessionExpired })) {
        return;
      }

      logger.warn('Failed to save notification settings');
      setSettings(settings);
      Alert.alert('Error', 'Failed to save setting. Please try again.');
    }
  }, [onSessionExpired, settings]);

  const handleDevicePermissionAction = useCallback(async () => {
    if (permissionStatus === 'denied') {
      const canOpenAppSettings = await Linking.canOpenURL('app-settings:');
      if (canOpenAppSettings) {
        await Linking.openURL('app-settings:');
        return;
      }

      await Linking.openSettings();
      return;
    }

    setSyncingDevice(true);
    try {
      const pushState = await syncPushNotificationRegistration({ allowPrompt: true });
      setPermissionStatus(pushState.permissionStatus);

      if (pushState.permissionStatus === 'granted' && pushState.isRegistered) {
        Alert.alert('Notifications Enabled', 'This device is now registered for Prioritize reminders.');
      }
    } catch (error: unknown) {
      if (await handleUnauthorizedIfNeeded({ error, source: 'NotificationSettings.handleDevicePermissionAction', onSessionExpired })) {
        return;
      }

      logger.warn('Failed to sync push notification registration');
      Alert.alert('Error', getUserFriendlyErrorMessage(error, 'Failed to configure push notifications.'));
    } finally {
      setSyncingDevice(false);
    }
  }, [onSessionExpired, permissionStatus]);

  const permissionIcon = permissionStatus === 'granted'
    ? 'notifications-active'
    : permissionStatus === 'denied'
      ? 'notifications-off'
      : 'notifications-none';

  const permissionTitle = permissionStatus === 'granted'
    ? 'Push notifications are enabled'
    : permissionStatus === 'denied'
      ? 'Push notifications are disabled on this iPhone'
      : 'Allow push notifications on this iPhone';

  const permissionDescription = permissionStatus === 'granted'
    ? 'Prioritize can deliver reminders and summaries to this device when the preferences below are enabled.'
    : permissionStatus === 'denied'
      ? 'Open iPhone Settings to turn notifications back on for Prioritize.'
      : 'Enable push access so Prioritize can deliver due reminders, overdue alerts, and optional daily summaries.';

  const permissionButtonLabel = permissionStatus === 'granted'
    ? 'Refresh device registration'
    : permissionStatus === 'denied'
      ? 'Open iPhone Settings'
      : 'Enable notifications';

  if (loading || !settings) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerBtn}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedText }]}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.introText, { color: colors.mutedText }]}>
          Choose which reminders and summaries you want to receive.
        </Text>

        <Text style={[styles.sectionLabel, { color: colors.mutedText }]}>DEVICE</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <View style={[styles.permissionCard, { borderBottomColor: colors.border }]}> 
            <View style={styles.rowLeft}> 
              <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}12` }]}> 
                <MaterialIcons name={permissionIcon as any} size={19} color={colors.primary} />
              </View>
              <View style={styles.textWrap}> 
                <Text style={[styles.rowTitle, { color: colors.text }]}>{permissionTitle}</Text>
                <Text style={[styles.rowDescription, { color: colors.mutedText }]}>{permissionDescription}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.permissionButton, { backgroundColor: colors.primary }]}
            onPress={handleDevicePermissionAction}
            activeOpacity={0.85}
            disabled={syncingDevice}
          >
            {syncingDevice ? (
              <ActivityIndicator size="small" color={colors.surface} />
            ) : (
              <Text style={[styles.permissionButtonText, { color: colors.surface }]}>{permissionButtonLabel}</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedText }]}>PREFERENCES</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {SETTING_ITEMS.map((item, index) => (
            <View
              key={item.key}
              style={[
                styles.row,
                { borderBottomColor: colors.border },
                index === SETTING_ITEMS.length - 1 && styles.rowLast,
              ]}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}12` }]}>
                  <MaterialIcons name={item.icon} size={19} color={colors.primary} />
                </View>
                <View style={styles.textWrap}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>{item.label}</Text>
                  <Text style={[styles.rowDescription, { color: colors.mutedText }]}>{item.description}</Text>
                </View>
              </View>

              <Switch
                value={settings[item.key]}
                onValueChange={(value) => updateSetting(item.key, value)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.surface}
                ios_backgroundColor={colors.border}
              />
            </View>
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  introText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  permissionCard: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  permissionButton: {
    margin: 14,
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    paddingTop: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  rowDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '500',
  },
});
