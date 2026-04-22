// src/screens/HomeScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, ActivityIndicator, Image, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { useTheme, useThemePreference } from '../theme';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import SwipeableTaskCard from '../components/SwipeableTaskCard';
import NotificationBell from '../components/NotificationBell';
import {
  ApiError,
  getTasks,
  getUnreadNotificationCount,
  getUserFriendlyErrorMessage,
  getUserProfile,
  Task,
  updateTask,
} from '../config/api';
import { Confetti } from '../components/Confetti';
import { useCompletionCelebration } from '../hooks/useCompletionCelebration';
import { logger } from '../utils/logger';
import { useAuth } from '../auth/AuthContext';
import { isAuthExitInProgress } from '../auth/authExitState';
import { handleUnauthorizedIfNeeded } from '../auth/unauthorizedHandler';

export default function HomeScreen({ route, navigation, onSessionExpired }: any) {
  const { colors } = useTheme();
  const { currentTheme } = useThemePreference();
  const { setAuthenticatedUser, user } = useAuth();
  const { isCelebrating, triggerCelebration } = useCompletionCelebration();
  const lastHandledCompletionEventIdRef = useRef<string | null>(null);
  const lastCelebrationAtRef = useRef(0);
  const transitioningResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusUpdateInFlightRef = useRef<Set<string>>(new Set());
  const [tab, setTab] = useState<'TODO' | 'COMPLETED'>('TODO');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState<string | null>(null);
  const [transitioningTaskId, setTransitioningTaskId] = useState<string | null>(null);
  const feedbackOpacity = useState(() => new Animated.Value(0))[0];
  const feedbackTranslateY = useState(() => new Animated.Value(-8))[0];
  const feedbackScale = useState(() => new Animated.Value(0.98))[0];
  const avatarScale = useState(() => new Animated.Value(1))[0];
  const notificationScale = useState(() => new Animated.Value(1))[0];
  const notificationBadgeScale = useState(() => new Animated.Value(1))[0];
  const tabIndicatorProgress = useRef(new Animated.Value(0)).current;
  const [tabsContainerWidth, setTabsContainerWidth] = useState(0);
  const sanitizedAvatarUri = avatarUri?.trim() || null;

  const triggerLightHaptic = () => {
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const handleTabPress = (nextTab: 'TODO' | 'COMPLETED') => {
    if (nextTab === tab) {
      return;
    }
    triggerLightHaptic();
    setTab(nextTab);
  };

  useEffect(() => {
    return () => {
      if (transitioningResetTimerRef.current) {
        clearTimeout(transitioningResetTimerRef.current);
        transitioningResetTimerRef.current = null;
      }
    };
  }, []);

  // Load avatar and unread notification count when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadAvatar();
      refreshAvatarFromProfile();
      loadUnreadCount();
    });

    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (typeof Notifications.addNotificationReceivedListener !== 'function') {
      return;
    }

    const subscription = Notifications.addNotificationReceivedListener(() => {
      void loadUnreadCount();
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const completionEventId = route?.params?.completionEventId;
    if (!completionEventId || typeof completionEventId !== 'string') {
      return;
    }

    if (lastHandledCompletionEventIdRef.current === completionEventId) {
      return;
    }

    const now = Date.now();
    const elapsed = now - lastCelebrationAtRef.current;
    if (elapsed < 1200) {
      return;
    }

    lastHandledCompletionEventIdRef.current = completionEventId;
    lastCelebrationAtRef.current = now;
    triggerCelebration();

    // Clear param immediately so it does not replay on future re-renders/focus.
    navigation.setParams({ completionEventId: undefined });
  }, [navigation, route?.params?.completionEventId, triggerCelebration]);

  const loadUnreadCount = async () => {
    try {
      const count = await getUnreadNotificationCount();
      setUnreadCount(count);
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
      const authAvatar = user?.avatarUrl?.trim() || null;
      if (authAvatar) {
        setAvatarUri(authAvatar);
        setAvatarLoadFailed(false);
        return;
      }

      const savedAvatar = await AsyncStorage.getItem('userAvatar');
      if (savedAvatar) {
        setAvatarUri(savedAvatar.trim());
        setAvatarLoadFailed(false);
        return;
      }
      // Fall back to avatarUrl stored in the user object (e.g. after a cold start)
      const storedUser = await AsyncStorage.getItem('user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        const fallbackAvatar = typeof parsed?.avatarUrl === 'string' ? parsed.avatarUrl.trim() : '';
        if (fallbackAvatar) {
          await AsyncStorage.setItem('userAvatar', fallbackAvatar);
          setAvatarUri(fallbackAvatar);
          setAvatarLoadFailed(false);
        }
      }
    } catch (error) {
      logger.warn('Failed to load avatar');
    }
  };

  const refreshAvatarFromProfile = async () => {
    try {
      const profile = await getUserProfile();
      await setAuthenticatedUser(profile);
      const nextAvatar = profile.avatarUrl?.trim() || null;
      if (nextAvatar) {
        await AsyncStorage.setItem('userAvatar', nextAvatar);
      } else {
        await AsyncStorage.removeItem('userAvatar');
      }
      setAvatarUri(nextAvatar);
      setAvatarLoadFailed(false);
    } catch {
      // Non-critical on Home screen
    }
  };

  // Fetch tasks from backend
  const fetchTasks = async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const fetchedTasks = await getTasks();
      setTasks(fetchedTasks);
      setScreenError(null);
    } catch (error: any) {
      if (error instanceof ApiError && error.status === 401) {
        logger.warn('Failed to fetch tasks: unauthorized');
        if (!isAuthExitInProgress()) {
          await onSessionExpired?.();
        }
        return;
      }

      logger.warn('Failed to fetch tasks');
      const message = getUserFriendlyErrorMessage(error, 'Failed to load tasks. Please try again.');
      setScreenError(message);
      if (tasks.length > 0) {
        Alert.alert('Refresh failed', message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Handle status change
  const handleStatusChange = async (taskId: string, newStatus: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED') => {
    if (statusUpdateInFlightRef.current.has(taskId)) {
      return;
    }
    statusUpdateInFlightRef.current.add(taskId);

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

        if (transitioningResetTimerRef.current) {
          clearTimeout(transitioningResetTimerRef.current);
        }

        transitioningResetTimerRef.current = setTimeout(() => {
          setTasks((prevTasks) =>
            prevTasks.map((task) =>
              task.id === taskId ? { ...task, status: newStatus, completedAt: completedAt || undefined } : task
            )
          );
          setTransitioningTaskId((current) => (current === taskId ? null : current));
          transitioningResetTimerRef.current = null;
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
        const now = Date.now();
        if (now - lastCelebrationAtRef.current >= 1200) {
          lastCelebrationAtRef.current = now;
          triggerCelebration();
        }
      } else if (previousTask?.status === 'COMPLETED' && newStatus === 'TODO') {
        showFeedback('Task moved back to active');
      } else {
        showFeedback('Task updated');
      }
    } catch (error) {
      if (await handleUnauthorizedIfNeeded({ error, source: 'HomeScreen.handleStatusChange', onSessionExpired })) {
        return;
      }

      logger.warn('Failed to update task status');
      Alert.alert('Error', 'Failed to update task status');
    } finally {
      statusUpdateInFlightRef.current.delete(taskId);
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
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const greetingText = useMemo(() => getGreeting(), []);
  const backgroundGradient = useMemo<readonly [string, string]>(
    () =>
      currentTheme === 'dark'
        ? ['#07101D', '#152440']
        : ['#FFFDF8', '#EEF4FF'],
    [currentTheme]
  );
  const headerGradient = useMemo<readonly [string, string]>(
    () =>
      currentTheme === 'dark'
        ? ['rgba(17, 28, 47, 0.96)', 'rgba(10, 17, 30, 0.92)']
        : ['rgba(255, 255, 255, 0.98)', 'rgba(241, 247, 255, 0.96)'],
    [currentTheme]
  );
  const isDark = currentTheme === 'dark';
  const headerBorderColor = isDark ? 'rgba(90, 113, 152, 0.28)' : 'rgba(0, 74, 173, 0.09)';
  const avatarBorderColor = isDark ? 'rgba(153, 178, 214, 0.30)' : 'rgba(7, 31, 66, 0.10)';
  const notificationSurface = isDark ? 'rgba(15, 26, 45, 0.92)' : 'rgba(246, 250, 255, 0.96)';
  const tabsSurface = isDark ? 'rgba(14, 24, 41, 0.94)' : 'rgba(255, 255, 255, 0.88)';
  const tabsBorder = isDark ? 'rgba(97, 116, 149, 0.28)' : 'rgba(0, 74, 173, 0.10)';
  const activeTabTextColor = '#FFFFFF';
  const inactiveTabTextColor = isDark ? '#A8B6CF' : '#5E6C86';
  const emptySurface = isDark ? 'rgba(15, 24, 40, 0.92)' : 'rgba(255, 255, 255, 0.88)';
  const emptyBorder = isDark ? 'rgba(92, 112, 145, 0.28)' : 'rgba(0, 74, 173, 0.10)';

  const insets = useSafeAreaInsets();

  const { activeCount, completedCount } = useMemo(() => {
    const active = tasks.filter((t) => t.status === 'TODO' || t.status === 'IN_PROGRESS').length;
    const completed = tasks.filter((t) => t.status === 'COMPLETED').length;

    return {
      activeCount: active,
      completedCount: completed,
    };
  }, [tasks]);
  const sectionSupportText =
    tab === 'TODO'
      ? `${activeCount} active task${activeCount === 1 ? '' : 's'} ready to move forward`
      : `${completedCount} completed task${completedCount === 1 ? '' : 's'} captured in your progress`;

  useEffect(() => {
    Animated.spring(tabIndicatorProgress, {
      toValue: tab === 'TODO' ? 0 : 1,
      tension: 200,
      friction: 20,
      useNativeDriver: true,
    }).start();
  }, [tab, tabIndicatorProgress]);

  const indicatorTravel = Math.max((tabsContainerWidth - 6) / 2, 0);
  const indicatorWidth = Math.max((tabsContainerWidth - 6) / 2, 0);
  const tabIndicatorTranslateX = tabIndicatorProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, indicatorTravel],
  });

  if (loading) {
    return (
      <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={backgroundGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View
          style={[
            styles.heroHeader,
            {
              paddingTop: insets.top + 14,
              shadowColor: isDark ? '#020617' : '#8AADE2',
              borderBottomColor: headerBorderColor,
            },
          ]}
        >
          <LinearGradient
            colors={headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.headerContent}>
            <View style={[styles.avatarPlaceholder, styles.skeletonBlock, { backgroundColor: colors.border }]} />
            <View style={styles.greetingContainer}>
              <View style={[styles.skeletonLineShort, { backgroundColor: colors.border }]} />
              <View style={[styles.skeletonLineLong, { backgroundColor: colors.border }]} />
            </View>
            <View style={[styles.notificationButton, { backgroundColor: notificationSurface, borderColor: headerBorderColor }]}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          </View>
        </View>

        <View style={[styles.tabsSection, { backgroundColor: colors.background }]}> 
          <View
            style={[
              styles.tabsContainer,
              {
                backgroundColor: tabsSurface,
                borderColor: tabsBorder,
                shadowColor: isDark ? '#020617' : '#9BB5E8',
              },
            ]}
          >
            <View style={[styles.skeletonTab, { backgroundColor: `${colors.primary}16` }]} />
            <View style={[styles.skeletonTab, { backgroundColor: colors.background }]} />
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Tasks</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.mutedText }]}>{sectionSupportText}</Text>
        </View>

        {screenError ? (
          <View style={[styles.inlineErrorCard, { backgroundColor: `${colors.danger}12`, borderColor: `${colors.danger}40` }]}>
            <View style={styles.inlineErrorHeader}>
              <MaterialIcons name="error-outline" size={18} color={colors.danger} />
              <Text style={[styles.inlineErrorTitle, { color: colors.text }]}>Couldn’t refresh tasks</Text>
            </View>
            <Text style={[styles.inlineErrorBody, { color: colors.mutedText }]}>{screenError}</Text>
            <TouchableOpacity
              style={[styles.inlineErrorRetryButton, { backgroundColor: colors.primary }]}
              onPress={() => fetchTasks(true)}
              activeOpacity={0.82}
            >
              <Text style={[styles.inlineErrorRetryText, { color: colors.surface }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.skeletonList}>
          {[0, 1, 2].map((item) => (
            <View key={item} style={[styles.skeletonCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <View style={[styles.skeletonLineLong, { backgroundColor: colors.border }]} />
              <View style={[styles.skeletonLineMedium, { backgroundColor: colors.border }]} />
              <View style={[styles.skeletonDivider, { backgroundColor: `${colors.border}99` }]} />
              <View style={styles.skeletonFooter}>
                <View style={[styles.skeletonLineShort, { backgroundColor: colors.border }]} />
                <View style={[styles.skeletonLineShort, { backgroundColor: colors.border }]} />
              </View>
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Confetti isVisible={isCelebrating} count={40} />
      <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={backgroundGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Hero Header */}
        <View
          style={[
            styles.heroHeader,
            {
              paddingTop: insets.top + 14,
              shadowColor: isDark ? '#020617' : '#8AADE2',
              borderBottomColor: headerBorderColor,
            },
          ]}
        >
          <LinearGradient
            colors={headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
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
              <View style={[styles.avatarShell, { borderColor: avatarBorderColor }]}>
                <View style={styles.avatarInner}>
                  {sanitizedAvatarUri && !avatarLoadFailed ? (
                    <Image
                      source={{ uri: sanitizedAvatarUri }}
                      style={styles.avatarImage}
                      resizeMode="cover"
                      onError={() => {
                        if (__DEV__) {
                          logger.warn('Avatar image failed to load on Home screen');
                        }
                        setAvatarLoadFailed(true);
                      }}
                    />
                  ) : (
                    <LinearGradient
                      colors={['#0A5DCD', '#004AAD']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.avatarPlaceholder}
                    >
                      <Text style={[styles.avatarInitials, { color: '#FFFFFF' }]}>{getInitials()}</Text>
                    </LinearGradient>
                  )}
                </View>
              </View>
            </TouchableOpacity>
            </Animated.View>

            <View style={styles.greetingContainer}>
              <Text style={[styles.greeting, { color: colors.mutedText }]}>{greetingText}</Text>
              <Text style={[styles.welcome, { color: colors.text }]}>{user?.firstName?.trim() || 'User'} 👋</Text>
              <Text style={[styles.subtitle, { color: colors.mutedText }]}>Let's make progress today.</Text>
            </View>

            <Animated.View style={{ transform: [{ scale: notificationScale }] }}>
            <TouchableOpacity
              style={[
                styles.notificationButton,
                { backgroundColor: notificationSurface, borderColor: headerBorderColor, shadowColor: colors.primary },
              ]}
              onPress={() => {
                triggerLightHaptic();
                navigation.navigate('Notifications');
              }}
              activeOpacity={0.85}
              onPressIn={() => {
                Animated.timing(notificationScale, {
                  toValue: 0.96,
                  duration: 75,
                  useNativeDriver: true,
                }).start();
              }}
              onPressOut={() => {
                Animated.spring(notificationScale, {
                  toValue: 1,
                  tension: 210,
                  friction: 17,
                  useNativeDriver: true,
                }).start();
              }}
            >
              <Animated.View style={{ transform: [{ scale: notificationBadgeScale }] }}>
                <NotificationBell count={unreadCount} />
              </Animated.View>
            </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
        {/* Tabs */}
        <View style={[styles.tabsSection, { backgroundColor: colors.background }]}>
          <View
            style={[
              styles.tabsContainer,
              {
                backgroundColor: tabsSurface,
                borderColor: tabsBorder,
                shadowColor: isDark ? '#020617' : '#9BB5E8',
              },
            ]}
            onLayout={(event) => setTabsContainerWidth(event.nativeEvent.layout.width)}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.tabIndicator,
                {
                  width: indicatorWidth,
                  backgroundColor: colors.primary,
                  shadowColor: colors.primary,
                  transform: [{ translateX: tabIndicatorTranslateX }],
                },
              ]}
            />
            <TouchableOpacity
              style={[
                styles.tab,
                tab === 'TODO' && styles.tabActive,
              ]}
              onPress={() => handleTabPress('TODO')}
              activeOpacity={0.82}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: inactiveTabTextColor },
                  tab === 'TODO' && [styles.tabTextActive, { color: activeTabTextColor }],
                ]}
              >
                Active
              </Text>
              <Text
                style={[
                  styles.tabCount,
                  { color: inactiveTabTextColor },
                  tab === 'TODO' && [styles.tabCountActive, { color: activeTabTextColor }],
                ]}
              >
                {activeCount}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tab,
                tab === 'COMPLETED' && styles.tabActive,
              ]}
              onPress={() => handleTabPress('COMPLETED')}
              activeOpacity={0.82}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: inactiveTabTextColor },
                  tab === 'COMPLETED' && [styles.tabTextActive, { color: activeTabTextColor }],
                ]}
              >
                Completed
              </Text>
              <Text
                style={[
                  styles.tabCount,
                  { color: inactiveTabTextColor },
                  tab === 'COMPLETED' && [styles.tabCountActive, { color: activeTabTextColor }],
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
          <Text style={[styles.sectionSubtitle, { color: colors.mutedText }]}>{sectionSupportText}</Text>
        </View>

        {filteredTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyPanel, { backgroundColor: emptySurface, borderColor: emptyBorder, shadowColor: isDark ? '#020617' : '#9BB5E8' }]}>
              <View style={[styles.emptyIconWrap, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}24` }]}>
                <MaterialIcons
                  name={tab === 'TODO' ? 'assignment' : 'check-circle'}
                  size={34}
                  color={tab === 'TODO' ? colors.primary : colors.success}
                />
              </View>
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
                  style={[styles.primaryCta, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
                  onPress={() => navigation.navigate('Create')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.primaryCtaText, { color: colors.surface }]}>Create your first task</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          <FlatList
            data={filteredTasks}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.taskListContent}
            refreshing={refreshing}
            onRefresh={() => fetchTasks(true)}
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
    position: 'relative',
    paddingHorizontal: 22,
    paddingBottom: 18,
    overflow: 'hidden',
    borderBottomWidth: 1,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 5,
  },
  headerContent: {
    position: 'relative',
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  
  // Avatar - 52×52, more prominent presence
  avatarTouchable: {
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarShell: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 17,
    fontWeight: '700',
  },

  greetingContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  greeting: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 1,
    letterSpacing: 0.4,
  },
  welcome: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
  },
  
  // Notification button — slightly larger for badge breathing room
  notificationButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginLeft: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 3,
  },
  // Tabs
  tabsSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 11,
  },
  tabsContainer: {
    position: 'relative',
    flexDirection: 'row',
    borderRadius: 19,
    padding: 4,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 15,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  tab: {
    zIndex: 1,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    gap: 5,
  },
  tabActive: {
    // Indicator handles active background and depth.
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    letterSpacing: 0.1,
  },
  tabCount: {
    fontSize: 11,
    fontWeight: '700',
  },
  tabCountActive: {
  },

  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 8,
  },
  sectionSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
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
  inlineErrorCard: {
    marginHorizontal: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inlineErrorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inlineErrorTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  inlineErrorBody: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
  },
  inlineErrorRetryButton: {
    alignSelf: 'flex-start',
    marginTop: 9,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  inlineErrorRetryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
  },

  // Task list
  taskListContent: {
    paddingTop: 0,
    paddingBottom: 112,
  },

  // Empty state - Softer colors and better spacing
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingBottom: 112,
  },
  emptyPanel: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 28,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 22,
    elevation: 5,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 14,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    fontWeight: '400',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryCta: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 999,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryCtaText: {
    fontSize: 14,
    fontWeight: '700',
  },

  skeletonList: {
    paddingTop: 2,
  },
  skeletonCard: {
    borderRadius: 18,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
  },
  skeletonLineShort: {
    width: '28%',
    height: 12,
    borderRadius: 999,
  },
  skeletonLineMedium: {
    width: '62%',
    height: 12,
    borderRadius: 999,
    marginTop: 10,
  },
  skeletonLineLong: {
    width: '74%',
    height: 14,
    borderRadius: 999,
  },
  skeletonDivider: {
    height: 1,
    marginVertical: 14,
  },
  skeletonFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  skeletonTab: {
    flex: 1,
    height: 44,
    borderRadius: 16,
  },
  skeletonBlock: {
    borderRadius: 26,
  },
});
