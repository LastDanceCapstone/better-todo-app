// src/screens/NotificationCenterScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import ScreenWrapper from '../components/ScreenWrapper';
import {
  getNotifications,
  markNotificationAsRead,
  Notification,
  NotificationType,
} from '../config/api';

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'Just now';

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(isoString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function getNotificationIcon(type: NotificationType): keyof typeof MaterialIcons.glyphMap {
  switch (type) {
    case 'MORNING_OVERVIEW':
      return 'wb-sunny';
    case 'EVENING_REVIEW':
      return 'nights-stay';
    case 'TASK_DUE_SOON':
      return 'schedule';
    case 'TASK_OVERDUE':
      return 'warning';
    default:
      return 'notifications';
  }
}

/**
 * Maps a notification to a navigation action.
 * Returns null if the notification has no specific navigation destination.
 *
 * TODO: When the backend exposes a taskId on task-related notifications,
 * resolve the task and navigate to TaskDetails with it here.
 */
function resolveNotificationNav(
  notification: Notification,
  navigation: any,
): (() => void) | null {
  switch (notification.type) {
    case 'TASK_DUE_SOON':
    case 'TASK_OVERDUE':
      // Navigate to Home (task list) as a best-effort destination until taskId is available.
      return () => navigation.navigate('Main');
    case 'MORNING_OVERVIEW':
    case 'EVENING_REVIEW':
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// NotificationCard
// ---------------------------------------------------------------------------

interface NotificationCardProps {
  notification: Notification;
  onPress: (notification: Notification) => void;
  onMarkRead: (notification: Notification) => void;
  colors: any;
}

function NotificationCard({ notification, onPress, onMarkRead, colors }: NotificationCardProps) {
  const isUnread = !notification.isRead;
  const icon = getNotificationIcon(notification.type);

  return (
    <Pressable
      onPress={() => onPress(notification)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: isUnread ? colors.primary : colors.border,
          borderLeftWidth: isUnread ? 4 : 1,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {/* Icon */}
      <View
        style={[
          styles.cardIconWrapper,
          { backgroundColor: isUnread ? colors.primary + '18' : colors.border + '50' },
        ]}
      >
        <MaterialIcons
          name={icon}
          size={20}
          color={isUnread ? colors.primary : colors.mutedText}
        />
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        <View style={styles.cardTitleRow}>
          <Text
            style={[
              styles.cardTitle,
              { color: isUnread ? colors.text : colors.mutedText },
              isUnread && styles.cardTitleUnread,
            ]}
            numberOfLines={1}
          >
            {notification.title}
          </Text>
          {isUnread && (
            <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
          )}
        </View>

        <Text
          style={[styles.cardMessage, { color: isUnread ? colors.text : colors.mutedText }]}
          numberOfLines={2}
        >
          {notification.message}
        </Text>

        <View style={styles.cardFooter}>
          <Text style={[styles.cardTimestamp, { color: colors.mutedText }]}>
            {formatRelativeTime(notification.createdAt)}
          </Text>

          {isUnread && (
            <TouchableOpacity
              onPress={() => onMarkRead(notification)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Text style={[styles.markReadButton, { color: colors.primary }]}>
                Mark as read
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// NotificationCenterScreen
// ---------------------------------------------------------------------------

export default function NotificationCenterScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      Alert.alert('Error', 'Failed to load notifications. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Reload when screen regains focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchNotifications(true);
    });
    return unsubscribe;
  }, [navigation, fetchNotifications]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications(true);
  }, [fetchNotifications]);

  const handleMarkRead = useCallback(
    async (notification: Notification) => {
      if (notification.isRead) return;
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id
            ? { ...n, isRead: true, readAt: new Date().toISOString() }
            : n,
        ),
      );
      try {
        await markNotificationAsRead(notification.id);
      } catch (err) {
        console.error('Failed to mark notification as read:', err);
        // Revert on failure
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, isRead: false, readAt: null } : n,
          ),
        );
        Alert.alert('Error', 'Failed to mark notification as read.');
      }
    },
    [],
  );

  const handlePress = useCallback(
    async (notification: Notification) => {
      if (!notification.isRead) {
        await handleMarkRead(notification);
      }
      const nav = resolveNotificationNav(notification, navigation);
      if (nav) nav();
    },
    [handleMarkRead, navigation],
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading) {
    return (
      <ScreenWrapper withHorizontalPadding={false}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('NotificationSettings')}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <MaterialIcons name="settings" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedText }]}>
            Loading notifications…
          </Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper withHorizontalPadding={false}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={[styles.headerBadge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.headerBadgeText, { color: colors.surface }]}>
                {unreadCount}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate('NotificationSettings')}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <MaterialIcons name="settings" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          notifications.length === 0 ? styles.emptyContainer : styles.listContent
        }
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="notifications-none" size={64} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>All caught up!</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedText }]}>
              No notifications yet. Check back later.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <NotificationCard
            notification={item}
            onPress={handlePress}
            onMarkRead={handleMarkRead}
            colors={colors}
          />
        )}
      />
    </ScreenWrapper>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '500',
  },

  // Header
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
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // List
  listContent: {
    padding: 16,
    gap: 10,
  },
  emptyContainer: {
    flex: 1,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 10,
  },
  cardIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  cardTitleUnread: {
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  cardMessage: {
    fontSize: 13,
    lineHeight: 19,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  cardTimestamp: {
    fontSize: 12,
    fontWeight: '500',
  },
  markReadButton: {
    fontSize: 12,
    fontWeight: '600',
  },
});
