import React, { useCallback, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Calendar from 'expo-calendar';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import {
  getOrCreatePrioritizeCalendarId,
  listUpcomingPrioritizeEvents,
  requestCalendarPermission,
} from '../services/calendarApp';

const APP_CALENDAR_STORAGE_KEY = 'prioritizeCalendarAppId';
const APP_CALENDAR_SYNC_ENABLED_KEY = 'prioritizeCalendarAppSyncEnabled';

export default function CalendarSettingsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [syncedCount, setSyncedCount] = useState(0);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);

      const syncEnabled = await AsyncStorage.getItem(APP_CALENDAR_SYNC_ENABLED_KEY);
      if (syncEnabled !== 'true') {
        setPermissionGranted(false);
        setConnected(false);
        setSyncedCount(0);
        return;
      }

      const permission = await Calendar.getCalendarPermissionsAsync();
      const granted = permission.status === 'granted';
      setPermissionGranted(granted);

      if (!granted) {
        setConnected(false);
        setSyncedCount(0);
        return;
      }

      const savedCalendarId = await AsyncStorage.getItem(APP_CALENDAR_STORAGE_KEY);
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const foundByTitle = calendars.some((calendar) => calendar.title === 'Prioritize');
      const foundById = savedCalendarId
        ? calendars.some((calendar) => calendar.id === savedCalendarId)
        : false;

      const isConnected = foundByTitle || foundById;
      setConnected(isConnected);

      if (!isConnected) {
        setSyncedCount(0);
        return;
      }

      const events = await listUpcomingPrioritizeEvents(60);
      setSyncedCount(events.length);
    } catch {
      setPermissionGranted(false);
      setConnected(false);
      setSyncedCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStatus();
    }, [loadStatus])
  );

  const handleConnect = async () => {
    try {
      setSyncing(true);
      const ok = await requestCalendarPermission();
      if (!ok) {
        Alert.alert('Permission needed', 'Allow Calendar access to enable sync.');
        return;
      }

      const calendarId = await getOrCreatePrioritizeCalendarId();
      await AsyncStorage.setItem(APP_CALENDAR_STORAGE_KEY, calendarId);
      Alert.alert('Connected', 'Apple Calendar sync is ready.');
      await loadStatus();
    } catch (error: any) {
      Alert.alert('Connect failed', error?.message ?? 'Unable to connect Apple Calendar.');
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleSync = async () => {
    try {
      setSyncing(true);

      if (connected) {
        await AsyncStorage.setItem(APP_CALENDAR_SYNC_ENABLED_KEY, 'false');
        setConnected(false);
        setSyncedCount(0);
        return;
      }

      const ok = await requestCalendarPermission();
      if (!ok) {
        Alert.alert('Permission needed', 'Allow Calendar access to enable sync.');
        return;
      }

      const calendarId = await getOrCreatePrioritizeCalendarId();
      await AsyncStorage.setItem(APP_CALENDAR_STORAGE_KEY, calendarId);
      await AsyncStorage.setItem(APP_CALENDAR_SYNC_ENABLED_KEY, 'true');
      setConnected(true);
      await loadStatus();
    } catch (error: any) {
      Alert.alert('Toggle failed', error?.message ?? 'Unable to change sync state.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}> 
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.headerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <View style={styles.headerMainRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <MaterialIcons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
              Calendar Settings
            </Text>
            <View style={styles.headerRightSpacer} />
          </View>
          <Text style={[styles.headerSubtitle, { color: colors.mutedText }]}>Manage Apple Calendar integration</Text>
        </View>

        <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <View style={styles.statusRow}>
            <View style={[styles.iconWrap, { backgroundColor: colors.background }]}> 
              <MaterialIcons name="calendar-today" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusTitle, { color: colors.text }]}>Apple Calendar Sync</Text>
              <Text style={[styles.statusSubtitle, { color: colors.mutedText }]}> 
                {connected ? 'Automatic sync is on' : 'Automatic sync is off'}
              </Text>
              <Text style={[styles.statusDetail, { color: colors.mutedText }]}> 
                Tasks with due dates will sync to Apple Calendar.
              </Text>
              {connected ? (
                <Text style={[styles.statusMeta, { color: colors.mutedText }]}> 
                  {`${syncedCount} upcoming synced event(s)`}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={[
                styles.pill,
                {
                  backgroundColor: connected ? `${colors.primary}18` : `${colors.mutedText}20`,
                  borderColor: connected ? `${colors.primary}55` : `${colors.border}`,
                },
              ]}
              onPress={handleToggleSync}
              disabled={syncing || loading}
              activeOpacity={0.75}
            >
              <Text style={[styles.pillText, { color: connected ? colors.primary : colors.mutedText }]}>
                {connected ? 'On' : 'Off'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.background }]}
              onPress={handleConnect}
              disabled={syncing || loading}
            >
              <Text style={[styles.secondaryText, { color: colors.text }]}>
                {syncing ? 'Updating...' : connected ? 'Reconnect' : 'Connect'}
              </Text>
            </TouchableOpacity>
          </View>

          {!permissionGranted ? (
            <Text style={[styles.permissionHint, { color: colors.mutedText }]}> 
              Calendar permission is required for sync.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },
  headerCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 2,
  },
  headerMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRightSpacer: {
    width: 36,
    height: 36,
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
  headerSubtitle: {
    marginTop: 6,
    fontSize: 14,
    textAlign: 'center',
  },
  statusCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusSubtitle: {
    marginTop: 2,
    fontSize: 13,
  },
  statusDetail: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
  },
  statusMeta: {
    marginTop: 4,
    fontSize: 12,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  permissionHint: {
    marginTop: 10,
    fontSize: 12,
  },
});
