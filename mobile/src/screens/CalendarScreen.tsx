import React, { useCallback, useMemo, useState } from 'react';
import {
  Animated,
  Alert,
  Easing,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, useThemePreference } from '../theme';
import { deleteTaskById, getTasks, getUserFriendlyErrorMessage, updateTask, type Task } from '../config/api';
import { handleUnauthorizedIfNeeded } from '../auth/unauthorizedHandler';
import ScreenWrapper from '../components/ScreenWrapper';
import AnimatedTaskCard from '../components/AnimatedTaskCard';
import AppButton from '../components/AppButton';

type CalendarDot = { key: string; color: string };

const isTaskCompleted = (task: Task) => task.status === 'COMPLETED';

const isTaskOverdue = (task: Task) => {
  if (isTaskCompleted(task) || !task.dueAt) return false;
  const due = new Date(task.dueAt);
  return !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
};

const toLocalDateKey = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatTime = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const formatDisplayDate = (isoDate: string) => {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

export default function CalendarScreen({ navigation, onSessionExpired }: any) {
  const { colors } = useTheme();
  const { currentTheme } = useThemePreference();
  const isDark = currentTheme === 'dark';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [showDateSheet, setShowDateSheet] = useState(false);
  const [pendingSheetDate, setPendingSheetDate] = useState<string | null>(null);

  const sheetTranslateY = React.useRef(new Animated.Value(28)).current;
  const backdropOpacity = React.useRef(new Animated.Value(0)).current;
  const calendarScale = React.useRef(new Animated.Value(1)).current;
  const openDelayRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const backgroundGradient = useMemo<readonly [string, string]>(
    () => (isDark ? ['#0B1220', '#121A2B'] : ['#F8FAFF', '#EEF3FB']),
    [isDark]
  );

  const headerSurface = isDark ? 'rgba(17, 27, 44, 0.84)' : 'rgba(255, 255, 255, 0.84)';
  const elevatedSurface = isDark ? 'rgba(17, 27, 44, 0.88)' : 'rgba(255, 255, 255, 0.92)';

  const pulseCalendar = useCallback((toValue: number = 0.985) => {
    Animated.sequence([
      Animated.timing(calendarScale, {
        toValue,
        duration: 85,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(calendarScale, {
        toValue: 1,
        tension: 210,
        friction: 19,
        useNativeDriver: true,
      }),
    ]).start();
  }, [calendarScale]);

  React.useEffect(() => {
    return () => {
      if (openDelayRef.current) {
        clearTimeout(openDelayRef.current);
        openDelayRef.current = null;
      }
    };
  }, []);

  const animateSheetIn = useCallback(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 170,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, sheetTranslateY]);

  const openDateSheet = useCallback(
    (dateString: string, delayMs: number) => {
      if (openDelayRef.current) {
        clearTimeout(openDelayRef.current);
      }

      setPendingSheetDate(dateString);
      openDelayRef.current = setTimeout(() => {
        setShowDateSheet(true);
      }, delayMs);
    },
    []
  );

  const closeDateSheet = useCallback(() => {
    if (openDelayRef.current) {
      clearTimeout(openDelayRef.current);
      openDelayRef.current = null;
    }

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 150,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 24,
        duration: 170,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setShowDateSheet(false);
      }
    });
  }, [backdropOpacity, sheetTranslateY]);

  React.useEffect(() => {
    if (!showDateSheet) return;

    sheetTranslateY.setValue(28);
    backdropOpacity.setValue(0);
    animateSheetIn();
  }, [showDateSheet, animateSheetIn, backdropOpacity, sheetTranslateY]);

  React.useEffect(() => {
    if (pendingSheetDate === null) return;
    if (!showDateSheet) return;

    setSelectedDate(pendingSheetDate);
    setPendingSheetDate(null);
  }, [pendingSheetDate, showDateSheet]);

  const loadTasks = useCallback(async (isPullRefresh = false) => {
    try {
      if (isPullRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const fetchedTasks = await getTasks();
      setTasks(fetchedTasks);
      setScreenError(null);
    } catch (error: unknown) {
      if (await handleUnauthorizedIfNeeded({ error, source: 'CalendarScreen.loadTasks', onSessionExpired })) {
        return;
      }

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

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();

    for (const task of tasks) {
      const key = toLocalDateKey(task.dueAt);
      if (!key) continue;

      const existing = map.get(key) ?? [];
      existing.push(task);
      map.set(key, existing);
    }

    return map;
  }, [tasks]);

  const selectedDateTasks = useMemo(() => {
    const selected = tasksByDate.get(selectedDate) ?? [];

    return [...selected].sort((left, right) => {
      const leftCompletedWeight = isTaskCompleted(left) ? 1 : 0;
      const rightCompletedWeight = isTaskCompleted(right) ? 1 : 0;
      if (leftCompletedWeight !== rightCompletedWeight) {
        return leftCompletedWeight - rightCompletedWeight;
      }

      const leftTime = left.dueAt ? new Date(left.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      const rightTime = right.dueAt ? new Date(right.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    });
  }, [tasksByDate, selectedDate]);

  const selectedCounts = useMemo(() => {
    let active = 0;
    let completed = 0;

    for (const task of selectedDateTasks) {
      if (isTaskCompleted(task)) completed += 1;
      else active += 1;
    }

    return { active, completed };
  }, [selectedDateTasks]);

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};

    tasksByDate.forEach((dayTasks, dateKey) => {
      let hasActive = false;
      let hasCompleted = false;

      for (const task of dayTasks) {
        if (isTaskCompleted(task)) hasCompleted = true;
        else hasActive = true;
      }

      const dots: CalendarDot[] = [];
      if (hasActive) dots.push({ key: 'active', color: colors.primary });
      if (hasCompleted) dots.push({ key: 'completed', color: colors.mutedText });

      marks[dateKey] = {
        ...(marks[dateKey] ?? {}),
        dots,
      };
    });

    marks[selectedDate] = {
      ...(marks[selectedDate] ?? {}),
      selected: true,
      selectedColor: colors.primary,
      selectedTextColor: 'white',
    };

    return marks;
  }, [tasksByDate, selectedDate, colors.primary, colors.mutedText]);

  const onDeleteTask = (taskId: string) => {
    Alert.alert('Delete task?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTaskById(taskId);
            await loadTasks(false);
          } catch (error: unknown) {
            if (await handleUnauthorizedIfNeeded({ error, source: 'CalendarScreen.onDeleteTask', onSessionExpired })) {
              return;
            }

            Alert.alert('Delete failed', getUserFriendlyErrorMessage(error, 'Could not delete task.'));
          }
        },
      },
    ]);
  };

  const onStatusChange = async (
    taskId: string,
    newStatus: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  ) => {
    try {
      const completedAt = newStatus === 'COMPLETED' ? new Date().toISOString() : null;
      await updateTask(taskId, { status: newStatus, completedAt });
      await loadTasks(false);
      if (newStatus === 'COMPLETED') {
        navigation.navigate('Home', {
          completionEventId: `${taskId}:${Date.now()}`,
        });
      }
    } catch (error: unknown) {
      if (await handleUnauthorizedIfNeeded({ error, source: 'CalendarScreen.onStatusChange', onSessionExpired })) {
        return;
      }

      Alert.alert('Error', getUserFriendlyErrorMessage(error, 'Failed to update task status.'));
    }
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
          { backgroundColor: isDark ? 'rgba(0, 74, 173, 0.2)' : 'rgba(0, 74, 173, 0.1)' },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.backgroundBlob,
          styles.backgroundBlobBottom,
          { backgroundColor: isDark ? 'rgba(77, 139, 230, 0.16)' : 'rgba(0, 74, 173, 0.08)' },
        ]}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadTasks(true)} tintColor={colors.primary} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.headerCard,
            {
              backgroundColor: headerSurface,
              borderColor: `${colors.border}CC`,
              shadowColor: isDark ? '#020617' : '#8EADE0',
            },
          ]}
        >
          <Text style={[styles.headerTitle, { color: colors.text }]}>Calendar</Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedText }]}>Tap a date to manage tasks</Text>

          <View style={styles.countChipsRow}>
            <View
              style={[
                styles.countChip,
                {
                  backgroundColor: `${colors.primary}14`,
                  borderColor: `${colors.primary}3A`,
                  shadowColor: isDark ? '#020617' : '#8EADE0',
                },
              ]}
            >
              <View style={[styles.countDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.countChipLabel, { color: colors.mutedText }]}>Active</Text>
              <Text style={[styles.countChipValue, { color: colors.text }]}>{selectedCounts.active}</Text>
            </View>

            <View
              style={[
                styles.countChip,
                {
                  backgroundColor: `${colors.mutedText}14`,
                  borderColor: `${colors.border}CC`,
                  shadowColor: isDark ? '#020617' : '#8EADE0',
                },
              ]}
            >
              <View style={[styles.countDot, { backgroundColor: colors.mutedText }]} />
              <Text style={[styles.countChipLabel, { color: colors.mutedText }]}>Completed</Text>
              <Text style={[styles.countChipValue, { color: colors.text }]}>{selectedCounts.completed}</Text>
            </View>
          </View>
        </View>

        <Animated.View
          style={[
            styles.calendarCard,
            {
              backgroundColor: elevatedSurface,
              borderColor: `${colors.border}D6`,
              shadowColor: isDark ? '#020617' : '#8EADE0',
              transform: [{ scale: calendarScale }],
            },
          ]}
        >
          <Calendar
            key={`calendar-${colors.background}-${colors.surface}-${colors.text}`}
            markingType="multi-dot"
            markedDates={markedDates}
            onDayPress={(day: { dateString: string }) => {
              const nextDate = day.dateString;
              const isDateChange = nextDate !== selectedDate;

              setSelectedDate(nextDate);
              pulseCalendar(isDateChange ? 0.982 : 0.988);

              // Keep selection immediate, but stage sheet opening so tap feels less abrupt.
              if (showDateSheet) {
                return;
              }

              openDateSheet(nextDate, isDateChange ? 120 : 60);
            }}
            onMonthChange={() => pulseCalendar(0.986)}
            style={{
              backgroundColor: elevatedSurface,
              borderRadius: 18,
            }}
            theme={{
              calendarBackground: elevatedSurface,
              textSectionTitleColor: colors.mutedText,
              dayTextColor: colors.text,
              textDayStyle: { color: colors.text },
              textDayFontWeight: '600',
              monthTextColor: colors.text,
              textMonthFontWeight: '800',
              textMonthFontSize: 17,
              textDisabledColor: colors.mutedText,
              todayTextColor: colors.primary,
              selectedDayBackgroundColor: colors.primary,
              selectedDayTextColor: '#FFFFFF',
              dotColor: colors.primary,
              selectedDotColor: '#FFFFFF',
              indicatorColor: colors.primary,
              arrowColor: colors.text,
              arrowStyle: {
                paddingHorizontal: 6,
                paddingVertical: 3,
              },
              textDayHeaderFontWeight: '700',
              textDayHeaderFontSize: 12,
            }}
          />
        </Animated.View>

        <View style={styles.tasksSectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Tasks on {formatDisplayDate(selectedDate)}</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.mutedText }]}>{selectedDateTasks.length} task(s)</Text>
        </View>

        {screenError ? (
          <View style={[styles.inlineErrorCard, { backgroundColor: `${colors.danger}12`, borderColor: `${colors.danger}40` }]}>
            <View style={styles.inlineErrorHeader}>
              <MaterialIcons name="error-outline" size={18} color={colors.danger} />
              <Text style={[styles.inlineErrorTitle, { color: colors.text }]}>Couldn’t refresh calendar data</Text>
            </View>
            <Text style={[styles.inlineErrorBody, { color: colors.mutedText }]}>{screenError}</Text>
            <AppButton title="Retry" onPress={() => loadTasks(true)} style={styles.inlineErrorRetry} />
          </View>
        ) : null}

        {loading && tasks.length === 0 ? (
          <View style={styles.loadingState}>
            <Text style={[styles.loadingText, { color: colors.mutedText }]}>Loading tasks...</Text>
          </View>
        ) : selectedDateTasks.length === 0 ? (
          <View
            style={[
              styles.emptyStateCard,
              {
                backgroundColor: elevatedSurface,
                borderColor: `${colors.border}D6`,
                shadowColor: isDark ? '#020617' : '#8EADE0',
              },
            ]}
          >
            <View style={[styles.emptyIconWrap, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}2E` }]}>
              <MaterialIcons name="event-busy" size={26} color={colors.primary} />
            </View>
            <Text style={[styles.emptyStateTitle, { color: colors.text }]}>No tasks on this date</Text>
            <Text style={[styles.emptyStateSubtitle, { color: colors.mutedText }]}>Tap a date to create one from the action sheet.</Text>
          </View>
        ) : (
          selectedDateTasks.map((task) => (
            <View
              key={task.id}
              style={[
                styles.taskRowLayer,
                isTaskOverdue(task)
                  ? {
                      backgroundColor: isDark ? 'rgba(180, 83, 9, 0.16)' : 'rgba(251, 191, 36, 0.16)',
                      borderColor: isDark ? 'rgba(217, 119, 6, 0.32)' : 'rgba(217, 119, 6, 0.22)',
                    }
                  : isTaskCompleted(task)
                    ? {
                        backgroundColor: isDark ? 'rgba(34, 197, 94, 0.14)' : 'rgba(34, 197, 94, 0.12)',
                        borderColor: isDark ? 'rgba(74, 222, 128, 0.28)' : 'rgba(34, 197, 94, 0.2)',
                      }
                    : {
                        backgroundColor: elevatedSurface,
                        borderColor: `${colors.border}D8`,
                      },
              ]}
            >
              <AnimatedTaskCard
                task={task}
                onPress={() => navigation.navigate('TaskDetails', { task })}
                onStatusChange={onStatusChange}
                onDelete={onDeleteTask}
                formatDisplayDate={(value) => formatTime(value ?? null) ?? 'No time'}
              />
            </View>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal transparent animationType="none" visible={showDateSheet} onRequestClose={closeDateSheet}>
        <View style={styles.sheetOverlay}>
          <Animated.View style={[styles.sheetBackdrop, { opacity: backdropOpacity }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeDateSheet} />
          </Animated.View>
          <Animated.View
            style={[
              styles.sheetCard,
              {
                backgroundColor: elevatedSurface,
                borderColor: colors.border,
                transform: [{ translateY: sheetTranslateY }],
              },
            ]}
          > 
            <View style={styles.sheetHeaderRow}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>{formatDisplayDate(selectedDate)}</Text>
              <TouchableOpacity onPress={closeDateSheet}>
                <MaterialIcons name="close" size={22} color={colors.mutedText} />
              </TouchableOpacity>
            </View>

            <AppButton
              title="Create task for this date"
              onPress={() => {
                closeDateSheet();
                navigation.navigate('Create', { prefillDateIso: selectedDate });
              }}
              leftIcon={<MaterialIcons name="add" size={20} color="#FFFFFF" />}
              style={styles.createActionButton}
            />

            {selectedDateTasks.length > 0 ? (
              <>
                <Text style={[styles.sheetListTitle, { color: colors.text }]}>Tasks</Text>
                <ScrollView style={{ maxHeight: 260 }}>
                  {selectedDateTasks.map((task) => (
                    <AnimatedTaskCard
                      key={`sheet-${task.id}`}
                      task={task}
                      onPress={() => navigation.navigate('TaskDetails', { task })}
                      onStatusChange={onStatusChange}
                      onDelete={onDeleteTask}
                      formatDisplayDate={(value) => formatTime(value ?? null) ?? 'No time'}
                    />
                  ))}
                </ScrollView>
              </>
            ) : (
              <Text style={[styles.sheetEmptyText, { color: colors.mutedText }]}>No tasks on this date yet.</Text>
            )}
          </Animated.View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  backgroundBlob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 1,
  },
  backgroundBlobTop: {
    width: 220,
    height: 220,
    top: 52,
    right: -70,
  },
  backgroundBlobBottom: {
    width: 170,
    height: 170,
    bottom: 118,
    left: -54,
  },
  headerCard: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginTop: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 21,
    fontWeight: '800',
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '500',
  },
  countChipsRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  countChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 1,
  },
  countDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  countChipLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  countChipValue: {
    fontSize: 11,
    fontWeight: '800',
  },
  calendarCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 13,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  tasksSectionHeader: {
    marginTop: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
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
  inlineErrorRetry: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  loadingState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
  },
  emptyStateCard: {
    borderWidth: 1,
    borderRadius: 18,
    minHeight: 188,
    paddingVertical: 26,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  emptyIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  emptyStateTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '800',
  },
  emptyStateSubtitle: {
    marginTop: 6,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  taskRowLayer: {
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 4,
    marginBottom: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  sheetCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
    maxHeight: '75%',
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  createActionButton: {
    marginTop: 12,
  },
  sheetListTitle: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '700',
  },
  sheetEmptyText: {
    marginTop: 14,
    fontSize: 13,
  },
});