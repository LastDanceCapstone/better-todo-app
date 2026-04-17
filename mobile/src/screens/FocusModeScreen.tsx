import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import ScreenWrapper from '../components/ScreenWrapper';
import FocusTimerRing from '../components/FocusTimerRing';
import { getTasks, getUserFriendlyErrorMessage, type Task, recordFocusSession, updateTask } from '../config/api';
import { useTheme, useThemePreference } from '../theme';
import {
  getFocusNotificationSuppressionEnabled,
  setFocusNotificationSuppressionEnabled,
  setFocusSessionActive,
} from '../services/pushNotifications';

const DEFAULT_SESSION_MINUTES = 25;
const DEFAULT_SESSION_SECONDS = DEFAULT_SESSION_MINUTES * 60;
const MIN_SESSION_MINUTES = 5;
const MAX_SESSION_MINUTES = 120;
const SESSION_DURATION_STEP_MINUTES = 5;
const FOCUS_DURATION_STORAGE_KEY = 'prioritizeFocusSessionMinutes';

type DateScope = 'today' | 'week';
type SessionStatus = 'idle' | 'running' | 'paused' | 'completed';

const startOfLocalDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);

const endOfLocalDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);

const getStartOfLocalWeekMonday = (reference: Date) => {
  const day = reference.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(reference);
  monday.setDate(reference.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const getEndOfLocalWeekSunday = (reference: Date) => {
  const sunday = getStartOfLocalWeekMonday(reference);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
};

const parseDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const formatRemainingTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const remainder = Math.max(0, seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${remainder}`;
};

const formatDueText = (dueAt?: string | null) => {
  const due = parseDate(dueAt);
  if (!due) return 'No due date';

  return due.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const isTaskIncomplete = (task: Task) => task.status === 'TODO' || task.status === 'IN_PROGRESS';

const normalizeSessionMinutes = (value: number): number => {
  const stepped = Math.round(value / SESSION_DURATION_STEP_MINUTES) * SESSION_DURATION_STEP_MINUTES;
  return Math.min(MAX_SESSION_MINUTES, Math.max(MIN_SESSION_MINUTES, stepped));
};

export default function FocusModeScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { currentTheme } = useThemePreference();
  const isDark = currentTheme === 'dark';

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completionPromptHandledRef = useRef(false);
  const allowNavigationAwayRef = useRef(false);
  const segmentProgress = useRef(new Animated.Value(0)).current;
  const primaryCtaScale = useRef(new Animated.Value(1)).current;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);

  const [dateScope, setDateScope] = useState<DateScope>('today');
  const [segmentWidth, setSegmentWidth] = useState(0);
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
  const [sessionTaskId, setSessionTaskId] = useState<string | null>(null);
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(DEFAULT_SESSION_MINUTES);
  const [plannedSessionSeconds, setPlannedSessionSeconds] = useState(DEFAULT_SESSION_SECONDS);
  const [remainingSeconds, setRemainingSeconds] = useState(DEFAULT_SESSION_SECONDS);
  const [sessionStartedAt, setSessionStartedAt] = useState<Date | null>(null);
  const [suppressInAppNotifications, setSuppressInAppNotifications] = useState(false);

  const backgroundGradient = useMemo<readonly [string, string]>(
    () => (isDark ? ['#07101D', '#13213B'] : ['#F8FBFF', '#EAF1FF']),
    [isDark]
  );

  const elevatedSurface = isDark ? 'rgba(16, 27, 43, 0.9)' : 'rgba(255, 255, 255, 0.92)';
  const mutedSurface = isDark ? 'rgba(12, 22, 36, 0.86)' : 'rgba(246, 250, 255, 0.94)';
  const cardBorder = isDark ? 'rgba(97, 118, 152, 0.28)' : 'rgba(0, 74, 173, 0.1)';

  const clearSessionInterval = useCallback(() => {
    if (!intervalRef.current) return;
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  const triggerSelectionHaptic = () => {
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const triggerImpactHaptic = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  };

  const loadTasks = useCallback(async (isPullRefresh = false) => {
    try {
      if (isPullRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const fetched = await getTasks();
      setTasks(fetched);
      setScreenError(null);
    } catch (error: unknown) {
      const message = getUserFriendlyErrorMessage(error, 'Failed to load tasks.');
      setScreenError(message);
      if (tasks.length > 0) {
        Alert.alert('Refresh failed', message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTasks(false);
    }, [loadTasks])
  );

  useEffect(() => {
    return () => {
      clearSessionInterval();
      void setFocusSessionActive(false);
    };
  }, [clearSessionInterval]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const storedMinutes = await AsyncStorage.getItem(FOCUS_DURATION_STORAGE_KEY);
        if (!storedMinutes || cancelled) {
          return;
        }

        const parsed = Number(storedMinutes);
        if (!Number.isFinite(parsed)) {
          return;
        }

        setSessionDurationMinutes(normalizeSessionMinutes(parsed));
      } catch {
        // Best-effort preference load.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void AsyncStorage.setItem(FOCUS_DURATION_STORAGE_KEY, String(sessionDurationMinutes)).catch(() => {
      // Best-effort preference save.
    });
  }, [sessionDurationMinutes]);

  useEffect(() => {
    if (sessionStatus === 'idle' || sessionStatus === 'completed') {
      const nextSeconds = sessionDurationMinutes * 60;
      setPlannedSessionSeconds(nextSeconds);
      setRemainingSeconds(nextSeconds);
    }
  }, [sessionDurationMinutes, sessionStatus]);

  useEffect(() => {
    void (async () => {
      const enabled = await getFocusNotificationSuppressionEnabled();
      setSuppressInAppNotifications(enabled);
    })();
  }, []);

  useEffect(() => {
    if (sessionStatus !== 'running') {
      clearSessionInterval();
      return;
    }

    if (intervalRef.current) return;

    intervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearSessionInterval();
  }, [clearSessionInterval, sessionStatus]);

  const completeCurrentFocusTask = useCallback(async () => {
    if (!sessionTaskId) return;

    try {
      await updateTask(sessionTaskId, {
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
      });

      await loadTasks(false);
      navigation.navigate('Home', {
        completionEventId: `${sessionTaskId}:${Date.now()}`,
      });
    } catch (error: unknown) {
      Alert.alert('Update failed', getUserFriendlyErrorMessage(error, 'Could not update task status.'));
    }
  }, [loadTasks, navigation, sessionTaskId]);

  const captureFocusSession = useCallback(async (options: { completed: boolean; interrupted: boolean }) => {
    if (!sessionStartedAt) {
      return;
    }

    const endedAt = new Date();
    const actualDurationSeconds = Math.max(0, Math.round((endedAt.getTime() - sessionStartedAt.getTime()) / 1000));

    try {
      await recordFocusSession({
        taskId: sessionTaskId || undefined,
        startedAt: sessionStartedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        plannedDurationSeconds: plannedSessionSeconds,
        actualDurationSeconds,
        completed: options.completed,
        interrupted: options.interrupted,
      });
    } catch {
      // Best-effort analytics: avoid blocking focus completion UX.
    }
  }, [plannedSessionSeconds, sessionStartedAt, sessionTaskId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event: any) => {
      if (allowNavigationAwayRef.current) {
        return;
      }

      if (sessionStatus !== 'running' && sessionStatus !== 'paused') {
        return;
      }

      event.preventDefault();

      Alert.alert('Leave focus session?', 'Leaving now will end this in-app focus session.', [
        {
          text: 'Keep Focusing',
          style: 'cancel',
        },
        {
          text: 'End Session & Leave',
          style: 'destructive',
          onPress: () => {
            allowNavigationAwayRef.current = true;
            clearSessionInterval();
            void captureFocusSession({ completed: false, interrupted: true });
            void setFocusSessionActive(false);
            setSessionStatus('idle');
            setSessionTaskId(null);
            setSessionStartedAt(null);
            setRemainingSeconds(sessionDurationMinutes * 60);
            navigation.dispatch(event.data.action);
          },
        },
      ]);
    });

    return unsubscribe;
  }, [captureFocusSession, clearSessionInterval, navigation, sessionDurationMinutes, sessionStatus]);

  useEffect(() => {
    if (sessionStatus !== 'running' || remainingSeconds > 0) return;

    clearSessionInterval();
    setSessionStatus('completed');
  }, [clearSessionInterval, remainingSeconds, sessionStatus]);

  useEffect(() => {
    if (sessionStatus !== 'completed') return;
    void captureFocusSession({ completed: true, interrupted: false });
    void setFocusSessionActive(false);
  }, [captureFocusSession, sessionStatus]);

  useEffect(() => {
    if (sessionStatus !== 'completed' || completionPromptHandledRef.current) return;
    completionPromptHandledRef.current = true;

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);

    Alert.alert('Session complete', 'Great focus session. What do you want to do next?', [
      {
        text: 'Mark Task Complete',
        onPress: () => {
          void completeCurrentFocusTask();
          setSelectedTaskId(null);
          setSessionTaskId(null);
          setSessionStartedAt(null);
          setRemainingSeconds(sessionDurationMinutes * 60);
          setSessionStatus('idle');
        },
      },
      {
        text: 'Start Another Session',
        onPress: () => {
          if (!sessionTaskId) {
            setSessionStatus('idle');
            return;
          }
          const nextPlannedSeconds = sessionDurationMinutes * 60;
          setSessionStartedAt(new Date());
          setPlannedSessionSeconds(nextPlannedSeconds);
          setRemainingSeconds(nextPlannedSeconds);
          setSessionStatus('running');
          void setFocusSessionActive(true);
          completionPromptHandledRef.current = false;
        },
      },
      {
        text: 'Done',
        style: 'cancel',
        onPress: () => {
          setSessionTaskId(null);
          setSessionStartedAt(null);
          setRemainingSeconds(sessionDurationMinutes * 60);
          setSessionStatus('idle');
        },
      },
    ]);
  }, [completeCurrentFocusTask, sessionDurationMinutes, sessionStatus, sessionTaskId]);

  const incompleteTasks = useMemo(() => {
    return tasks
      .filter(isTaskIncomplete)
      .sort((left, right) => {
        const leftDue = parseDate(left.dueAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const rightDue = parseDate(right.dueAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return leftDue - rightDue;
      });
  }, [tasks]);

  useEffect(() => {
    if (!selectedTaskId) return;
    const stillExists = incompleteTasks.some((task) => task.id === selectedTaskId);
    if (!stillExists) {
      setSelectedTaskId(null);
    }
  }, [incompleteTasks, selectedTaskId]);

  const selectedTask = useMemo(() => {
    if (sessionTaskId && sessionStatus !== 'idle') {
      return tasks.find((task) => task.id === sessionTaskId) ?? null;
    }

    if (!selectedTaskId) return null;
    return tasks.find((task) => task.id === selectedTaskId) ?? null;
  }, [selectedTaskId, sessionStatus, sessionTaskId, tasks]);

  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const todayEnd = endOfLocalDay(now);
  const weekStart = getStartOfLocalWeekMonday(now);
  const weekEnd = getEndOfLocalWeekSunday(now);

  const pendingDueToday = useMemo(() => {
    return tasks.filter((task) => {
      if (!isTaskIncomplete(task)) return false;
      const due = parseDate(task.dueAt);
      if (!due) return false;
      return due >= todayStart && due <= todayEnd;
    }).length;
  }, [tasks, todayEnd, todayStart]);

  const pendingDueWeek = useMemo(() => {
    return tasks.filter((task) => {
      if (!isTaskIncomplete(task)) return false;
      const due = parseDate(task.dueAt);
      if (!due) return false;
      return due >= weekStart && due <= weekEnd;
    }).length;
  }, [tasks, weekEnd, weekStart]);

  const progressTodayCompleted = useMemo(() => {
    return tasks.filter((task) => {
      if (task.status !== 'COMPLETED') return false;
      const completed = parseDate(task.completedAt);
      if (!completed) return false;
      return completed >= todayStart && completed <= todayEnd;
    }).length;
  }, [tasks, todayEnd, todayStart]);

  const progressTodayTarget = useMemo(() => {
    const dueTodayTotal = tasks.filter((task) => {
      const due = parseDate(task.dueAt);
      if (!due) return false;
      return due >= todayStart && due <= todayEnd;
    }).length;

    return Math.max(dueTodayTotal, progressTodayCompleted, 1);
  }, [progressTodayCompleted, tasks, todayEnd, todayStart]);

  const timerLabel = formatRemainingTime(remainingSeconds);
  const progressDenominator = Math.max(plannedSessionSeconds, 1);
  const sessionProgress = Math.min(1, Math.max(0, 1 - remainingSeconds / progressDenominator));

  const summaryCount = dateScope === 'today' ? pendingDueToday : pendingDueWeek;
  const summaryLabel = dateScope === 'today' ? 'due today' : 'due this week';

  const sessionStatusText =
    sessionStatus === 'running'
      ? 'Focus session in progress'
      : sessionStatus === 'paused'
        ? 'Session paused'
        : sessionStatus === 'completed'
          ? 'Session complete'
          : selectedTask
            ? 'Ready to focus'
            : 'Select a task to begin';

  const primaryButtonTitle =
    sessionStatus === 'running'
      ? 'End Session'
      : sessionStatus === 'paused'
        ? 'Resume Focus'
        : 'Start Focusing';

  const primaryDisabled =
    sessionStatus === 'idle' || sessionStatus === 'completed'
      ? !selectedTask
      : false;

  const canAdjustDuration = sessionStatus !== 'running' && sessionStatus !== 'paused';

  const adjustSessionDuration = (deltaMinutes: number) => {
    if (!canAdjustDuration) {
      return;
    }

    triggerSelectionHaptic();
    setSessionDurationMinutes((previous) => normalizeSessionMinutes(previous + deltaMinutes));
  };

  useEffect(() => {
    Animated.timing(segmentProgress, {
      toValue: dateScope === 'today' ? 0 : 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [dateScope, segmentProgress]);

  const segmentTravel = Math.max((segmentWidth - 6) / 2, 0);
  const segmentIndicatorWidth = Math.max((segmentWidth - 6) / 2, 0);
  const segmentIndicatorTranslateX = segmentProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, segmentTravel],
  });

  const animatePrimaryCta = (toValue: number) => {
    Animated.spring(primaryCtaScale, {
      toValue,
      tension: 220,
      friction: 18,
      useNativeDriver: true,
    }).start();
  };

  const beginNewSession = () => {
    if (!selectedTaskId) {
      Alert.alert('Select a task', 'Choose a task to focus on before starting.');
      return;
    }

    triggerImpactHaptic();
    const nextPlannedSeconds = sessionDurationMinutes * 60;
    completionPromptHandledRef.current = false;
    setSessionTaskId(selectedTaskId);
    setSessionStartedAt(new Date());
    setPlannedSessionSeconds(nextPlannedSeconds);
    setRemainingSeconds(nextPlannedSeconds);
    setSessionStatus('running');
    void setFocusSessionActive(true);
  };

  const pauseSession = () => {
    if (sessionStatus !== 'running') return;
    triggerSelectionHaptic();
    setSessionStatus('paused');
    void setFocusSessionActive(false);
  };

  const resumeSession = () => {
    if (sessionStatus !== 'paused') return;
    triggerSelectionHaptic();
    setSessionStatus('running');
    void setFocusSessionActive(true);
  };

  const endSessionEarly = () => {
    if (sessionStatus !== 'running') return;
    Alert.alert('End focus session?', 'You can restart this session anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Session',
        style: 'destructive',
        onPress: () => {
          triggerSelectionHaptic();
          clearSessionInterval();
          void captureFocusSession({ completed: false, interrupted: true });
          void setFocusSessionActive(false);
          setSessionStatus('idle');
          setSessionTaskId(null);
          setSessionStartedAt(null);
          setRemainingSeconds(sessionDurationMinutes * 60);
        },
      },
    ]);
  };

  const onPrimaryCtaPress = () => {
    if (sessionStatus === 'running') {
      endSessionEarly();
      return;
    }

    if (sessionStatus === 'paused') {
      resumeSession();
      return;
    }

    beginNewSession();
  };

  return (
    <ScreenWrapper withHorizontalPadding={false}>
      <LinearGradient
        colors={backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View
        pointerEvents="none"
        style={[
          styles.backgroundBlob,
          styles.backgroundBlobTop,
          { backgroundColor: isDark ? 'rgba(0, 74, 173, 0.18)' : 'rgba(0, 74, 173, 0.1)' },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.backgroundBlob,
          styles.backgroundBlobBottom,
          { backgroundColor: isDark ? 'rgba(118, 170, 248, 0.14)' : 'rgba(0, 74, 173, 0.08)' },
        ]}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadTasks(true)}
            tintColor={colors.primary}
          />
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.headerCard,
            {
              backgroundColor: elevatedSurface,
              borderColor: cardBorder,
              shadowColor: isDark ? '#020617' : '#8AADE2',
            },
          ]}
        >
          <Text style={[styles.screenTitle, { color: colors.text }]}>Focus Sessions</Text>
          <Text style={[styles.screenSubtitle, { color: colors.mutedText }]}>Single-task deep work with fewer in-app interruptions.</Text>

          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: mutedSurface,
                borderColor: cardBorder,
                shadowColor: isDark ? '#020617' : '#8AADE2',
              },
            ]}
          >
            <View style={styles.summaryTopRow}>
              <Text style={[styles.summaryCount, { color: colors.text }]}>{summaryCount}</Text>
              <Text style={[styles.summaryLabel, { color: colors.mutedText }]}>{summaryLabel}</Text>
            </View>

            <View
              style={[
                styles.segmentedControl,
                {
                  backgroundColor: isDark ? 'rgba(11, 22, 38, 0.95)' : 'rgba(255,255,255,0.9)',
                  borderColor: cardBorder,
                  shadowColor: isDark ? '#020617' : '#9BB5E8',
                },
              ]}
              onLayout={(event) => setSegmentWidth(event.nativeEvent.layout.width)}
            >
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.segmentIndicator,
                  {
                    width: segmentIndicatorWidth,
                    backgroundColor: colors.primary,
                    shadowColor: colors.primary,
                    transform: [{ translateX: segmentIndicatorTranslateX }],
                  },
                ]}
              />
              <TouchableOpacity
                onPress={() => {
                  triggerSelectionHaptic();
                  setDateScope('today');
                }}
                style={styles.segmentButton}
                activeOpacity={0.88}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: dateScope === 'today' ? '#FFFFFF' : colors.mutedText },
                  ]}
                >
                  Today
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  triggerSelectionHaptic();
                  setDateScope('week');
                }}
                style={styles.segmentButton}
                activeOpacity={0.88}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: dateScope === 'week' ? '#FFFFFF' : colors.mutedText },
                  ]}
                >
                  Week
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.focusTaskCard,
            {
              backgroundColor: elevatedSurface,
              borderColor: cardBorder,
              shadowColor: isDark ? '#020617' : '#8AADE2',
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Session settings</Text>
          <Text style={[styles.sectionCaption, { color: colors.mutedText }]}>Reduce app distractions while your in-app focus session is active.</Text>

          <View style={styles.suppressionRow}>
            <View style={styles.suppressionTextWrap}>
              <Text style={[styles.suppressionTitle, { color: colors.text }]}>Suppress in-app notifications</Text>
              <Text style={[styles.suppressionSubtitle, { color: colors.mutedText }]}>Suppress this app’s notification banners and sounds during an active focus session.</Text>
            </View>
            <Switch
              value={suppressInAppNotifications}
              onValueChange={(value) => {
                setSuppressInAppNotifications(value);
                void setFocusNotificationSuppressionEnabled(value);
              }}
              trackColor={{ true: `${colors.primary}88` }}
              thumbColor={suppressInAppNotifications ? colors.primary : '#D1D5DB'}
            />
          </View>
        </View>

        <View
          style={[
            styles.focusTaskCard,
            {
              backgroundColor: elevatedSurface,
              borderColor: cardBorder,
              shadowColor: isDark ? '#020617' : '#8AADE2',
            },
          ]}
        >
          {screenError ? (
            <View style={[styles.inlineErrorCard, { backgroundColor: `${colors.danger}12`, borderColor: `${colors.danger}40` }]}>
              <View style={styles.inlineErrorHeader}>
                <MaterialIcons name="error-outline" size={18} color={colors.danger} />
                <Text style={[styles.inlineErrorTitle, { color: colors.text }]}>Couldn’t refresh tasks</Text>
              </View>
              <Text style={[styles.inlineErrorBody, { color: colors.mutedText }]}>{screenError}</Text>
              <TouchableOpacity
                style={[styles.inlineErrorRetryButton, { backgroundColor: colors.primary }]}
                onPress={() => loadTasks(true)}
                activeOpacity={0.82}
              >
                <Text style={[styles.inlineErrorRetryText, { color: '#FFFFFF' }]}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Focus task</Text>
          <Text style={[styles.sectionCaption, { color: colors.mutedText }]}>Choose one task and give it your full attention.</Text>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              if (sessionStatus === 'running' || sessionStatus === 'paused') return;
              setTaskPickerOpen(true);
            }}
            style={[
              styles.taskPickerButton,
              {
                backgroundColor: mutedSurface,
                borderColor: selectedTask ? `${colors.primary}66` : cardBorder,
                opacity: sessionStatus === 'running' || sessionStatus === 'paused' ? 0.74 : 1,
                shadowColor: isDark ? '#020617' : '#8AADE2',
              },
            ]}
          >
            <View style={styles.taskPickerContent}>
              <View style={[styles.taskPickerIconWrap, { backgroundColor: selectedTask ? `${colors.primary}20` : `${colors.mutedText}16` }]}>
                <MaterialIcons
                  name="task-alt"
                  size={18}
                  color={selectedTask ? colors.primary : colors.mutedText}
                />
              </View>
              <View style={styles.taskPickerTextWrap}>
                <Text
                  numberOfLines={1}
                  style={[styles.taskPickerTitle, { color: selectedTask ? colors.text : colors.mutedText }]}
                >
                  {selectedTask?.title ?? (incompleteTasks.length === 0 ? 'No active tasks available' : 'Select a task to focus on')}
                </Text>
                <Text style={[styles.taskPickerMeta, { color: colors.mutedText }]}> 
                  {selectedTask ? formatDueText(selectedTask.dueAt) : `${incompleteTasks.length} task${incompleteTasks.length === 1 ? '' : 's'} available`}
                </Text>
              </View>
            </View>
            <MaterialIcons
              name={sessionStatus === 'running' || sessionStatus === 'paused' ? 'lock' : 'keyboard-arrow-down'}
              size={22}
              color={colors.mutedText}
            />
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.timerSection,
            {
              backgroundColor: elevatedSurface,
              borderColor: cardBorder,
              shadowColor: isDark ? '#020617' : '#8AADE2',
            },
          ]}
        >
          <View
            style={[
              styles.timerSurface,
              {
                backgroundColor: isDark ? 'rgba(11, 22, 38, 0.95)' : 'rgba(255,255,255,0.9)',
                borderColor: sessionStatus === 'running' ? `${colors.primary}6B` : cardBorder,
              },
            ]}
          >
            <FocusTimerRing
              progress={sessionStatus === 'running' ? sessionProgress : sessionStatus === 'completed' ? 1 : sessionProgress}
              timeLabel={timerLabel}
              isActive={sessionStatus === 'running'}
              statusLabel={sessionStatus === 'paused' ? 'Paused' : sessionStatus === 'completed' ? 'Complete' : sessionStatus === 'running' ? 'In Session' : 'Ready'}
            />

            <View style={styles.durationControlRow}>
              <TouchableOpacity
                activeOpacity={0.84}
                disabled={!canAdjustDuration || sessionDurationMinutes <= MIN_SESSION_MINUTES}
                onPress={() => adjustSessionDuration(-SESSION_DURATION_STEP_MINUTES)}
                style={[
                  styles.durationButton,
                  {
                    borderColor: cardBorder,
                    backgroundColor: mutedSurface,
                    opacity: !canAdjustDuration || sessionDurationMinutes <= MIN_SESSION_MINUTES ? 0.45 : 1,
                  },
                ]}
              >
                <MaterialIcons name="remove" size={18} color={colors.text} />
              </TouchableOpacity>

              <View style={styles.durationLabelWrap}>
                <Text style={[styles.durationValueText, { color: colors.text }]}>{sessionDurationMinutes} min</Text>
                <Text style={[styles.durationHintText, { color: colors.mutedText }]}>Session duration</Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.84}
                disabled={!canAdjustDuration || sessionDurationMinutes >= MAX_SESSION_MINUTES}
                onPress={() => adjustSessionDuration(SESSION_DURATION_STEP_MINUTES)}
                style={[
                  styles.durationButton,
                  {
                    borderColor: cardBorder,
                    backgroundColor: mutedSurface,
                    opacity: !canAdjustDuration || sessionDurationMinutes >= MAX_SESSION_MINUTES ? 0.45 : 1,
                  },
                ]}
              >
                <MaterialIcons name="add" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          <View
            style={[
              styles.sessionStateBadge,
              {
                backgroundColor:
                  sessionStatus === 'running'
                    ? `${colors.primary}16`
                    : sessionStatus === 'completed'
                      ? `${colors.success}20`
                      : `${colors.mutedText}14`,
                borderColor:
                  sessionStatus === 'running'
                    ? `${colors.primary}3B`
                    : sessionStatus === 'completed'
                      ? `${colors.success}3D`
                      : cardBorder,
              },
            ]}
          >
            <MaterialIcons
              name={
                sessionStatus === 'running'
                  ? 'timer'
                  : sessionStatus === 'paused'
                    ? 'pause-circle'
                    : sessionStatus === 'completed'
                      ? 'check-circle'
                      : 'hourglass-empty'
              }
              size={15}
              color={
                sessionStatus === 'running'
                  ? colors.primary
                  : sessionStatus === 'completed'
                    ? colors.success
                    : colors.mutedText
              }
            />
            <Text style={[styles.sessionStateText, { color: colors.text }]}>{sessionStatusText}</Text>
          </View>

          <Text style={[styles.focusHint, { color: colors.mutedText }]}> 
            Stay with one task, pause when needed, and finish with a clear complete/interrupted outcome.
          </Text>

          <Text style={[styles.sessionLengthText, { color: colors.mutedText }]}>Adjust in 5-minute steps ({MIN_SESSION_MINUTES}-{MAX_SESSION_MINUTES} min)</Text>

          <Animated.View
            style={[
              styles.primaryCtaWrap,
              { transform: [{ scale: primaryCtaScale }] },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              disabled={primaryDisabled}
              onPress={onPrimaryCtaPress}
              onPressIn={() => animatePrimaryCta(0.975)}
              onPressOut={() => animatePrimaryCta(1)}
              style={[
                styles.primaryCtaButton,
                {
                  opacity: primaryDisabled ? 0.55 : 1,
                  shadowColor: colors.primary,
                  borderColor: `${colors.primary}55`,
                },
              ]}
            >
              <LinearGradient
                colors={sessionStatus === 'running' ? ['#1E3A8A', '#004AAD'] : ['#0A5DCD', '#004AAD']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryCtaGradient}
              >
                <MaterialIcons
                  name={sessionStatus === 'running' ? 'stop-circle' : sessionStatus === 'paused' ? 'play-circle-fill' : 'play-arrow'}
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.primaryCtaText}>{primaryButtonTitle}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {sessionStatus === 'running' ? (
            <TouchableOpacity
              onPress={pauseSession}
              activeOpacity={0.82}
              style={[styles.secondarySessionButton, { borderColor: cardBorder, backgroundColor: mutedSurface }]}
            >
              <MaterialIcons name="pause" size={16} color={colors.text} />
              <Text style={[styles.secondarySessionText, { color: colors.text }]}>Pause Session</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View
          style={[
            styles.progressCard,
            {
              backgroundColor: elevatedSurface,
              borderColor: cardBorder,
              shadowColor: isDark ? '#020617' : '#8AADE2',
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Today’s progress</Text>
          <Text style={[styles.progressText, { color: colors.mutedText }]}> 
            {progressTodayCompleted} of {progressTodayTarget} tasks completed today
          </Text>
          <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(99, 124, 160, 0.35)' : '#D9E6FF' }]}> 
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(100, Math.round((progressTodayCompleted / progressTodayTarget) * 100))}%`,
                  backgroundColor: colors.primary,
                },
              ]}
            />
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedText }]}>Loading focus data...</Text>
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={taskPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTaskPickerOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setTaskPickerOpen(false)} />
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: elevatedSurface,
                borderColor: cardBorder,
                shadowColor: isDark ? '#020617' : '#8AADE2',
              },
            ]}
          > 
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Choose a focus task</Text>
              <TouchableOpacity onPress={() => setTaskPickerOpen(false)}>
                <MaterialIcons name="close" size={22} color={colors.mutedText} />
              </TouchableOpacity>
            </View>

            {incompleteTasks.length === 0 ? (
              <View style={styles.emptyPickerState}>
                <View style={[styles.emptyPickerIconWrap, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}38` }]}>
                  <MaterialIcons name="playlist-add-check-circle" size={28} color={colors.primary} />
                </View>
                <Text style={[styles.emptyPickerTitle, { color: colors.text }]}>No active tasks</Text>
                <Text style={[styles.emptyPickerText, { color: colors.mutedText }]}> 
                  Create a task first, then come back to start a focus session.
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.taskList}>
                {incompleteTasks.map((task) => {
                  const selected = task.id === selectedTaskId;
                  return (
                    <TouchableOpacity
                      key={task.id}
                      onPress={() => {
                        triggerSelectionHaptic();
                        setSelectedTaskId(task.id);
                        setTaskPickerOpen(false);
                      }}
                      activeOpacity={0.9}
                      style={[
                        styles.taskItem,
                        {
                          borderColor: selected ? `${colors.primary}70` : cardBorder,
                          backgroundColor: selected ? `${colors.primary}16` : mutedSurface,
                        },
                      ]}
                    >
                      <View style={styles.taskItemTextWrap}>
                        <Text numberOfLines={1} style={[styles.taskItemTitle, { color: colors.text }]}>
                          {task.title}
                        </Text>
                        <Text style={[styles.taskItemMeta, { color: colors.mutedText }]}>{formatDueText(task.dueAt)}</Text>
                      </View>
                      {selected ? (
                        <MaterialIcons name="check-circle" size={20} color={colors.primary} />
                      ) : (
                        <MaterialIcons name="radio-button-unchecked" size={20} color={colors.mutedText} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    paddingTop: 4,
    gap: 12,
  },
  backgroundBlob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 1,
  },
  backgroundBlobTop: {
    width: 220,
    height: 220,
    top: 70,
    right: -72,
  },
  backgroundBlobBottom: {
    width: 170,
    height: 170,
    bottom: 140,
    left: -56,
  },
  headerCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 15,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  screenTitle: {
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  screenSubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  summaryCard: {
    marginTop: 12,
    borderRadius: 15,
    borderWidth: 1,
    padding: 12,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 7,
  },
  summaryCount: {
    fontSize: 30,
    fontWeight: '900',
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'lowercase',
  },
  segmentedControl: {
    position: 'relative',
    marginTop: 9,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 3,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  segmentIndicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: 11,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  segmentButton: {
    zIndex: 1,
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  focusTaskCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  sectionCaption: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '500',
  },
  inlineErrorCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
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
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
  },
  inlineErrorRetryButton: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    marginTop: 9,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  inlineErrorRetryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  taskPickerButton: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  taskPickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  taskPickerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskPickerTextWrap: {
    marginLeft: 9,
    flex: 1,
  },
  taskPickerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  taskPickerMeta: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '500',
  },
  timerSection: {
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    paddingTop: 15,
    paddingBottom: 18,
    paddingHorizontal: 14,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
  timerSurface: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  durationControlRow: {
    marginTop: 10,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  durationButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationLabelWrap: {
    minWidth: 112,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationValueText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  durationHintText: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  sessionStateBadge: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sessionStateText: {
    fontSize: 12,
    fontWeight: '700',
  },
  focusHint: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    maxWidth: 286,
    fontWeight: '500',
  },
  sessionLengthText: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  primaryCtaWrap: {
    width: '100%',
    marginTop: 11,
  },
  primaryCtaButton: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 5,
  },
  primaryCtaGradient: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryCtaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  secondarySessionButton: {
    marginTop: 9,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  secondarySessionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  suppressionRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  suppressionTextWrap: {
    flex: 1,
  },
  suppressionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  suppressionSubtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
  },
  progressCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  progressText: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
  },
  progressTrack: {
    height: 11,
    borderRadius: 999,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '500',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    maxHeight: '74%',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  taskList: {
    paddingTop: 10,
    paddingBottom: 10,
    gap: 8,
  },
  taskItem: {
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taskItemTextWrap: {
    flex: 1,
    marginRight: 12,
  },
  taskItemTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  taskItemMeta: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '500',
  },
  emptyPickerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyPickerIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  emptyPickerTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyPickerText: {
    marginTop: 4,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
});