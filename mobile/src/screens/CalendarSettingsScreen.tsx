import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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
import { getUserFriendlyErrorMessage } from '../config/api';
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
    } catch (error: unknown) {
      Alert.alert('Connect failed', getUserFriendlyErrorMessage(error, 'Unable to connect Apple Calendar.'));
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
    } catch (error: unknown) {
      Alert.alert('Toggle failed', getUserFriendlyErrorMessage(error, 'Unable to change sync state.'));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Standard header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Calendar</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.introText, { color: colors.mutedText }]}>
          Sync your tasks with due dates to Apple Calendar.
        </Text>

        <Text style={[styles.sectionLabel, { color: colors.mutedText }]}>APPLE CALENDAR</Text>
        <View style={[styles.syncCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.syncCardTop}>
            <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}15` }]}>
              <MaterialIcons name="calendar-today" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.syncTitleRow}>
                <Text style={[styles.syncTitle, { color: colors.text }]}>Apple Calendar Sync</Text>
                <TouchableOpacity
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor: connected ? `${colors.primary}15` : `${colors.mutedText}15`,
                      borderColor: connected ? `${colors.primary}40` : colors.border,
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
              <Text style={[styles.syncSubtitle, { color: colors.mutedText }]}>
                {connected ? 'Automatic sync is active' : 'Automatic sync is off'}
              </Text>
            </View>
          </View>

          <Text style={[styles.syncDescription, { color: colors.mutedText }]}>
            Tasks with due dates automatically appear in your Apple Calendar. Tap &quot;Off&quot; to disable at any time.
          </Text>

          {connected ? (
            <View style={[styles.syncMeta, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <MaterialIcons name="check-circle" size={15} color={colors.success} />
              <Text style={[styles.syncMetaText, { color: colors.mutedText }]}>
                {syncedCount} upcoming event{syncedCount !== 1 ? 's' : ''} synced
              </Text>
            </View>
          ) : null}

          {!permissionGranted && (
            <View style={[styles.syncMeta, { backgroundColor: `${colors.danger}10`, borderColor: `${colors.danger}30` }]}>
              <MaterialIcons name="warning" size={15} color={colors.danger} />
              <Text style={[styles.syncMetaText, { color: colors.danger }]}>
                Calendar permission required
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.connectButton,
              {
                backgroundColor: connected ? colors.background : colors.primary,
                borderColor: connected ? colors.border : colors.primary,
              },
            ]}
            onPress={handleConnect}
            disabled={syncing || loading}
            activeOpacity={0.8}
          >
            {syncing ? (
              <ActivityIndicator size="small" color={connected ? colors.mutedText : '#FFFFFF'} />
            ) : (
              <>
                <MaterialIcons
                  name={connected ? 'refresh' : 'link'}
                  size={18}
                  color={connected ? colors.mutedText : '#FFFFFF'}
                />
                <Text style={[styles.connectButtonText, { color: connected ? colors.mutedText : '#FFFFFF' }]}>
                  {connected ? 'Reconnect' : 'Connect Apple Calendar'}
                </Text>
              </>
            )}
          </TouchableOpacity>
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
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
  syncCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  syncCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  syncTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  syncSubtitle: {
    fontSize: 13,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  syncDescription: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  syncMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 12,
  },
  syncMetaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4,
  },
  connectButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
