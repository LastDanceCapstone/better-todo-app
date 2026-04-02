// src/screens/HomeScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, ActivityIndicator, Image, Animated, Easing } from 'react-native';
import { useTheme } from '../theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import SwipeableTaskCard from '../components/SwipeableTaskCard';
import { getTasks, updateTask, getNotifications, Task } from '../config/api';

export default function HomeScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const [tab, setTab] = useState<'TODO' | 'COMPLETED'>('TODO');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [feedbackText, setFeedbackText] = useState<string | null>(null);
  const [transitioningTaskId, setTransitioningTaskId] = useState<string | null>(null);
  const feedbackOpacity = useState(() => new Animated.Value(0))[0];
  const feedbackTranslateY = useState(() => new Animated.Value(-8))[0];
  const feedbackScale = useState(() => new Animated.Value(0.98))[0];
  const avatarScale = useState(() => new Animated.Value(1))[0];
  const notificationScale = useState(() => new Animated.Value(1))[0];
  const notificationBadgeScale = useState(() => new Animated.Value(1))[0];

  // Get user data from route params or AsyncStorage
  useEffect(() => {
    const getUserData = async () => {
      try {
        // First try to get from route params (when coming from login)
        if (route?.params?.user) {
          setUser(route.params.user);
        } else {
          // Otherwise get from AsyncStorage
          const storedUser = await AsyncStorage.getItem('user');
          if (storedUser) {
            setUser(JSON.parse(storedUser));
          }
        }
      } catch (error) {
        console.error('Error getting user data:', error);
      }
    };

    getUserData();
  }, [route]);

  // Load avatar and unread notification count when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadAvatar();
      loadUnreadCount();
    });

    return unsubscribe;
  }, [navigation]);

  const loadUnreadCount = async () => {
    try {
      const notifications = await getNotifications();
      setUnreadCount(notifications.filter((n) => !n.isRead).length);
    } catch {
      // Non-critical — silently ignore
    }
  };

  useEffect(() => {
    if (unreadCount <= 0) return;

    Animated.sequence([
      Animated.timing(notificationBadgeScale, {
        toValue: 1.14,
        duration: 140,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(notificationBadgeScale, {
        toValue: 1,
        duration: 160,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [unreadCount, notificationBadgeScale]);

  const loadAvatar = async () => {
    try {
      const savedAvatar = await AsyncStorage.getItem('userAvatar');
      if (savedAvatar) {
        setAvatarUri(savedAvatar);
      }
    } catch (error) {
      console.error('Error loading avatar:', error);
    }
  };

  // Fetch tasks from backend
  const fetchTasks = async () => {
    try {
      setLoading(true);
      const fetchedTasks = await getTasks();
      setTasks(fetchedTasks);
    } catch (error) {
      console.error('Network error fetching tasks:', error);
      Alert.alert('Error', 'Failed to load tasks. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // Handle status change
  const handleStatusChange = async (taskId: string, newStatus: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED') => {
    const previousTask = tasks.find((task) => task.id === taskId);

    const showFeedback = (message: string) => {
      setFeedbackText(message);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(feedbackOpacity, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(feedbackTranslateY, {
            toValue: 0,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(feedbackScale, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(1050),
        Animated.parallel([
          Animated.timing(feedbackOpacity, {
            toValue: 0,
            duration: 170,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(feedbackTranslateY, {
            toValue: -8,
            duration: 170,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(feedbackScale, {
            toValue: 0.985,
            duration: 170,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]).start(({ finished }) => {
        if (finished) {
          setFeedbackText(null);
          feedbackScale.setValue(0.98);
        }
      });
    };

    try {
      const completedAt = newStatus === 'COMPLETED' ? new Date().toISOString() : null;
      // Use shared update helper so sync hooks stay centralized.
      await updateTask(taskId, { status: newStatus, completedAt });

      // Add a brief transition phase so cards don't disappear too abruptly between tabs.
      const crossesTabBoundary =
        (tab === 'TODO' && newStatus === 'COMPLETED') ||
        (tab === 'COMPLETED' && newStatus !== 'COMPLETED');

      if (crossesTabBoundary) {
        setTransitioningTaskId(taskId);
        setTimeout(() => {
          setTasks((prevTasks) =>
            prevTasks.map((task) =>
              task.id === taskId ? { ...task, status: newStatus, completedAt: completedAt || undefined } : task
            )
          );
          setTransitioningTaskId((current) => (current === taskId ? null : current));
        }, 220);
      } else {
        setTasks((prevTasks) =>
          prevTasks.map((task) =>
            task.id === taskId ? { ...task, status: newStatus, completedAt: completedAt || undefined } : task
          )
        );
      }

      if (newStatus === 'COMPLETED') {
        showFeedback('Task completed');
      } else if (previousTask?.status === 'COMPLETED' && newStatus === 'TODO') {
        showFeedback('Task moved back to active');
      } else {
        showFeedback('Task updated');
      }
    } catch (error) {
      console.error('Error updating task status:', error);
      Alert.alert('Error', 'Failed to update task status');
    }
  };

  // Fetch tasks when component mounts and when screen comes into focus
  useEffect(() => {
    fetchTasks();
    
    // Add listener to refresh tasks when screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      fetchTasks();
    });

    return unsubscribe;
  }, [navigation]);

  // Helper function to format due date
  const formatDueDate = (dueDate?: string) => {
    if (!dueDate) return 'No due date';
    
    const date = new Date(dueDate);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return 'Overdue';
    } else if (diffDays === 0) {
      return 'Due today';
    } else if (diffDays === 1) {
      return 'Due tomorrow';
    } else {
      return `${diffDays} days left`;
    }
  };

  // Helper function to format due date for display
  const formatDisplayDate = (dueDate?: string) => {
    if (!dueDate) return 'No due date';
    
    const date = new Date(dueDate);
    const formattedDate = date.toLocaleDateString(undefined, {
      month: 'short', 
      day: 'numeric' 
    });
    const formattedTime = date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `${formattedDate} • ${formattedTime}`;
  };

  const filteredTasks = tasks.filter((t) =>
    tab === 'TODO'
      ? t.status === 'TODO' || t.status === 'IN_PROGRESS'
      : t.status === 'COMPLETED'
  );

  const getInitials = () => {
    if (!user) return '?';
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    const firstInitial = firstName.charAt(0)?.toUpperCase() || '';
    const lastInitial = lastName.charAt(0)?.toUpperCase() || '';
    return `${firstInitial}${lastInitial}` || '?';
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const { activeCount, completedCount } = useMemo(() => {
    const active = tasks.filter((t) => t.status === 'TODO' || t.status === 'IN_PROGRESS').length;
    const completed = tasks.filter((t) => t.status === 'COMPLETED').length;

    return {
      activeCount: active,
      completedCount: completed,
    };
  }, [tasks]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedText }]}>Loading your tasks...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Hero Header */}
        <View style={[styles.heroHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={styles.headerContent}>
            <Animated.View style={{ transform: [{ scale: avatarScale }] }}>
            <TouchableOpacity
              style={styles.avatarTouchable}
              onPress={() => navigation.navigate('Account')}
              activeOpacity={0.85}
              onPressIn={() => {
                Animated.timing(avatarScale, {
                  toValue: 0.96,
                  duration: 90,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.timing(avatarScale, {
                  toValue: 1,
                  duration: 120,
                  easing: Easing.out(Easing.cubic),
                  useNativeDriver: true,
                }).start();
              }}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.avatarInitials, { color: colors.surface }]}>{getInitials()}</Text>
                </View>
              )}
            </TouchableOpacity>
            </Animated.View>

            <View style={styles.greetingContainer}>
              <Text style={[styles.greeting, { color: colors.mutedText }]}>{getGreeting()}</Text>
              <Text style={[styles.welcome, { color: colors.text }]}>{user?.firstName || 'User'} 👋</Text>
              <Text style={[styles.subtitle, { color: colors.mutedText }]}>Let's make progress today.</Text>
            </View>

            <Animated.View style={{ transform: [{ scale: notificationScale }] }}>
            <TouchableOpacity
              style={[styles.notificationButton, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => navigation.navigate('Notifications')}
              activeOpacity={0.85}
              onPressIn={() => {
                Animated.timing(notificationScale, {
                  toValue: 0.95,
                  duration: 90,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.timing(notificationScale, {
                  toValue: 1,
                  duration: 120,
                  easing: Easing.out(Easing.cubic),
                  useNativeDriver: true,
                }).start();
              }}
            >
              <MaterialIcons name="notifications" size={22} color={colors.text} />
              {unreadCount > 0 && (
                <Animated.View
                  style={[
                    styles.notificationBadge,
                    { backgroundColor: colors.danger },
                    { transform: [{ scale: notificationBadgeScale }] },
                  ]}
                >
                  <Text style={[styles.notificationBadgeText, { color: colors.surface }]}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </Animated.View>
              )}
            </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
        {/* Tabs */}
        <View style={[styles.tabsSection, { backgroundColor: colors.background }]}>
          <View style={[styles.tabsContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[
                styles.tab,
                tab === 'TODO' && [styles.tabActive, { backgroundColor: `${colors.primary}E6`, shadowColor: colors.primary }],
              ]}
              onPress={() => setTab('TODO')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: colors.mutedText },
                  tab === 'TODO' && [styles.tabTextActive, { color: colors.surface }],
                ]}
              >
                Active
              </Text>
              <Text
                style={[
                  styles.tabCount,
                  { color: colors.mutedText },
                  tab === 'TODO' && [styles.tabCountActive, { color: colors.surface }],
                ]}
              >
                {activeCount}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tab,
                tab === 'COMPLETED' && [styles.tabActive, { backgroundColor: `${colors.primary}E6`, shadowColor: colors.primary }],
              ]}
              onPress={() => setTab('COMPLETED')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: colors.mutedText },
                  tab === 'COMPLETED' && [styles.tabTextActive, { color: colors.surface }],
                ]}
              >
                Completed
              </Text>
              <Text
                style={[
                  styles.tabCount,
                  { color: colors.mutedText },
                  tab === 'COMPLETED' && [styles.tabCountActive, { color: colors.surface }],
                ]}
              >
                {completedCount}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {feedbackText ? (
          <Animated.View
            style={[
              styles.feedbackBanner,
              {
                backgroundColor: `${colors.success}22`,
                borderColor: `${colors.success}55`,
                opacity: feedbackOpacity,
                transform: [{ translateY: feedbackTranslateY }, { scale: feedbackScale }],
              },
            ]}
          >
            <MaterialIcons name="check-circle" size={16} color={colors.success} />
            <Text style={[styles.feedbackText, { color: colors.text }]}>{feedbackText}</Text>
          </Animated.View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Tasks</Text>
        </View>

        {filteredTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons
              name={tab === 'TODO' ? 'assignment' : 'check-circle'}
              size={56}
              color={colors.border}
            />
            <Text style={[styles.emptyText, { color: colors.text }]}>
              {tab === 'TODO' ? 'No active tasks yet' : 'No completed tasks yet'}
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.mutedText }]}>
              {tab === 'TODO'
                ? 'You are all clear. Create a task to start momentum.'
                : 'Finished tasks will appear here as you complete them.'}
            </Text>
            {tab === 'TODO' && (
              <TouchableOpacity
                style={[styles.primaryCta, { backgroundColor: colors.primary }]}
                onPress={() => navigation.navigate('Create')}
                activeOpacity={0.8}
              >
                <Text style={[styles.primaryCtaText, { color: colors.surface }]}>Create your first task</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredTasks}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.taskListContent}
            refreshing={loading}
            onRefresh={fetchTasks}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <SwipeableTaskCard
                task={item}
                onPress={() => navigation.navigate('TaskDetails', { task: item })}
                onStatusChange={handleStatusChange}
                formatDueDate={formatDueDate}
                formatDisplayDate={formatDisplayDate}
                isTransitioning={transitioningTaskId === item.id}
              />
            )}
          />
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  // Main container
  container: { 
    flex: 1,
  },
  
  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },

  // Hero header
  heroHeader: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  
  // Avatar - Larger (56x56) and more prominent
  avatarTouchable: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 20,
    fontWeight: '700',
  },

  greetingContainer: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  greeting: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  welcome: {
    fontSize: 21,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  
  // Notification button - Rounded with touch feedback
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },

  // Tabs
  tabsSection: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 6,
  },
  tabActive: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
  },
  tabCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  tabCountActive: {
  },

  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 8,
  },
  feedbackBanner: {
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  feedbackText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },

  // Task list
  taskListContent: {
    paddingTop: 4,
    paddingBottom: 120,
  },

  // Empty state - Softer colors and better spacing
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 120,
  },
  emptyText: {
    fontSize: 19,
    fontWeight: '600',
    marginTop: 18,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    fontWeight: '400',
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 21,
  },
  primaryCta: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 2,
  },
  primaryCtaText: {
    fontSize: 14,
    fontWeight: '700',
  },

});
