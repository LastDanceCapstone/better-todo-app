import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { deleteTaskById, getTasks, type Task } from '../config/api';

type CalendarDot = { key: string; color: string };

const isTaskCompleted = (task: Task) => task.status === 'COMPLETED';

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

const getSubtaskProgress = (task: Task) => {
  const subtasks = task.subtasks ?? [];
  if (subtasks.length === 0) return null;
  const completed = subtasks.filter((subtask) => subtask.status === 'COMPLETED').length;
  return `${completed}/${subtasks.length}`;
};

const getPriorityLabel = (priority: Task['priority']) =>
  priority.charAt(0) + priority.slice(1).toLowerCase();

export default function CalendarScreen({ navigation }: any) {
  const { colors } = useTheme();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDateSheet, setShowDateSheet] = useState(false);

  const loadTasks = useCallback(async (isPullRefresh = false) => {
    try {
      if (isPullRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const fetchedTasks = await getTasks();
      setTasks(fetchedTasks);
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'Failed to load tasks.');
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
          } catch (error: any) {
            Alert.alert('Delete failed', error?.message ?? 'Could not delete task.');
          }
        },
      },
    ]);
  };

  const TaskCard = ({ task, compact = false }: { task: Task; compact?: boolean }) => {
    const dueTime = formatTime(task.dueAt);
    const subtaskProgress = getSubtaskProgress(task);
    const completed = isTaskCompleted(task);

    return (
      <Pressable
        onPress={() => navigation.navigate('TaskDetails', { task })}
        style={[
          styles.taskCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            paddingVertical: compact ? 10 : 12,
          },
        ]}
      >
        <View style={styles.taskHeaderRow}>
          <Text numberOfLines={2} style={[styles.taskTitle, { color: colors.text }]}>
            {task.title}
          </Text>
          <TouchableOpacity
            onPress={() => onDeleteTask(task.id)}
            style={[styles.deleteButton, { borderColor: colors.border, backgroundColor: colors.background }]}
            activeOpacity={0.7}
          >
            <MaterialIcons name="delete-outline" size={18} color={colors.danger} />
          </TouchableOpacity>
        </View>

        <View style={styles.pillRow}>
          <View
            style={[
              styles.pill,
              {
                backgroundColor: `${colors.primary}15`,
                borderColor: `${colors.primary}40`,
              },
            ]}
          >
            <Text style={[styles.pillText, { color: colors.primary }]}>Priority: {getPriorityLabel(task.priority)}</Text>
          </View>

          <View
            style={[
              styles.pill,
              {
                backgroundColor: completed ? `${colors.mutedText}1A` : `${colors.primary}12`,
                borderColor: completed ? `${colors.mutedText}33` : `${colors.primary}33`,
              },
            ]}
          >
            <Text style={[styles.pillText, { color: completed ? colors.mutedText : colors.primary }]}> 
              {completed ? 'Completed' : 'Active'}
            </Text>
          </View>
        </View>

        <View style={styles.taskMetaRow}>
          <Text style={[styles.taskMeta, { color: colors.mutedText }]}>{dueTime ? dueTime : 'No time'}</Text>
          {subtaskProgress ? (
            <Text style={[styles.taskMeta, { color: colors.mutedText }]}>Subtasks: {subtaskProgress}</Text>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}> 
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadTasks(true)} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.headerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.headerTitle, { color: colors.text }]}>Calendar</Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedText }]}>Tap a date to manage tasks</Text>
          <Text style={[styles.headerCounts, { color: colors.mutedText }]}> 
            Active: {selectedCounts.active} • Completed: {selectedCounts.completed}
          </Text>
        </View>

        <View style={[styles.calendarCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Calendar
            key={`calendar-${colors.background}-${colors.surface}-${colors.text}`}
            markingType="multi-dot"
            markedDates={markedDates}
            onDayPress={(day: { dateString: string }) => {
              setSelectedDate(day.dateString);
              setShowDateSheet(true);
            }}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
            }}
            theme={{
              calendarBackground: colors.surface,
              textSectionTitleColor: colors.mutedText,
              dayTextColor: colors.text,
              textDayStyle: { color: colors.text },
              textDayFontWeight: '500',
              monthTextColor: colors.text,
              textMonthFontWeight: '700',
              textMonthFontSize: 16,
              textDisabledColor: colors.mutedText,
              todayTextColor: colors.primary,
              selectedDayBackgroundColor: colors.primary,
              selectedDayTextColor: '#FFFFFF',
              dotColor: colors.primary,
              selectedDotColor: '#FFFFFF',
              indicatorColor: colors.primary,
              arrowColor: colors.text,
            }}
          />
        </View>

        <View style={styles.tasksSectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Tasks on {formatDisplayDate(selectedDate)}</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.mutedText }]}>{selectedDateTasks.length} task(s)</Text>
        </View>

        {loading && tasks.length === 0 ? (
          <View style={styles.loadingState}>
            <Text style={[styles.loadingText, { color: colors.mutedText }]}>Loading tasks...</Text>
          </View>
        ) : selectedDateTasks.length === 0 ? (
          <View style={[styles.emptyStateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <MaterialIcons name="event-busy" size={28} color={colors.mutedText} />
            <Text style={[styles.emptyStateTitle, { color: colors.text }]}>No tasks on this date</Text>
            <Text style={[styles.emptyStateSubtitle, { color: colors.mutedText }]}>Tap a date to create one from the action sheet.</Text>
          </View>
        ) : (
          selectedDateTasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal transparent animationType="slide" visible={showDateSheet} onRequestClose={() => setShowDateSheet(false)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setShowDateSheet(false)} />
          <View style={[styles.sheetCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <View style={styles.sheetHeaderRow}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>{formatDisplayDate(selectedDate)}</Text>
              <TouchableOpacity onPress={() => setShowDateSheet(false)}>
                <MaterialIcons name="close" size={22} color={colors.mutedText} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.createActionButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                setShowDateSheet(false);
                navigation.navigate('Create', { prefillDateIso: selectedDate });
              }}
              activeOpacity={0.8}
            >
              <MaterialIcons name="add" size={20} color="white" />
              <Text style={styles.createActionText}>Create task for this date</Text>
            </TouchableOpacity>

            {selectedDateTasks.length > 0 ? (
              <>
                <Text style={[styles.sheetListTitle, { color: colors.text }]}>Tasks</Text>
                <ScrollView style={{ maxHeight: 260 }}>
                  {selectedDateTasks.map((task) => (
                    <TaskCard key={`sheet-${task.id}`} task={task} compact />
                  ))}
                </ScrollView>
              </>
            ) : (
              <Text style={[styles.sheetEmptyText, { color: colors.mutedText }]}>No tasks on this date yet.</Text>
            )}
          </View>
        </View>
      </Modal>

      {/* Manual QA checklist:
          1) Pull to refresh loads tasks
          2) Dates with tasks show dots
          3) Tap date opens modal; Create Task navigates with prefilled date
          4) Delete task updates list and date dots
          5) Subtask completion rollback handled in TaskDetails/backend
      */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerSubtitle: {
    marginTop: 6,
    fontSize: 14,
  },
  headerCounts: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
  },
  calendarCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 8,
    marginTop: 12,
  },
  tasksSectionHeader: {
    marginTop: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
  },
  taskCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  taskHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  taskTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  deleteButton: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 6,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  taskMetaRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskMeta: {
    fontSize: 12,
    fontWeight: '500',
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
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  emptyStateTitle: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyStateSubtitle: {
    marginTop: 4,
    fontSize: 13,
    textAlign: 'center',
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
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  createActionText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
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
