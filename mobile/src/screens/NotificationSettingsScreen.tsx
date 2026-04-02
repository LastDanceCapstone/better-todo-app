import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import {
  getNotificationSettings,
  NotificationSettings,
  saveNotificationSettings,
} from '../config/notificationSettings';

type NotificationSettingKey = keyof NotificationSettings;

interface SettingItem {
  key: NotificationSettingKey;
  label: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}

const SETTING_ITEMS: SettingItem[] = [
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
    key: 'taskDueReminders',
    label: 'Task Due Reminders',
    description: 'Get notified when tasks are approaching their due time.',
    icon: 'schedule',
  },
  {
    key: 'overdueTaskAlerts',
    label: 'Overdue Task Alerts',
    description: 'Get notified when tasks become overdue.',
    icon: 'warning',
  },
];

export default function NotificationSettingsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const loaded = await getNotificationSettings();
      setSettings(loaded);
    } catch (error) {
      console.error('Failed to load notification settings:', error);
      Alert.alert('Error', 'Failed to load notification settings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

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
      console.error('Failed to save notification settings:', error);
      setSettings(settings);
      Alert.alert('Error', 'Failed to save setting. Please try again.');
    }
  }, [settings]);

  if (loading || !settings) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Notification Settings</Text>
          <View style={styles.backButton} />
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
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notification Settings</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.subtitle, { color: colors.mutedText }]}>
          Choose which reminders and summaries you want to receive.
        </Text>

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
                <View style={[styles.iconWrap, { backgroundColor: colors.background }]}>
                  <MaterialIcons name={item.icon} size={20} color={colors.primary} />
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
      </View>
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
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backButton: {
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
    padding: 16,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
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
    gap: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
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
