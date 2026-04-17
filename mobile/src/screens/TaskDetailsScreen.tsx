// src/screens/TaskDetailsScreen.tsx
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Platform,
  Modal,
  Pressable,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme, useThemePreference } from '../theme';
import {
  ApiError,
  createSubtaskForTask,
  deleteSubtaskById,
  deleteTaskById,
  getTaskById,
  getUserFriendlyErrorMessage,
  updateSubtaskById,
  updateTask,
} from '../config/api';
import { logger } from '../utils/logger';

type Subtask = {
  id: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  completedAt?: string;
  createdAt: string;
};

type Task = {
  id: string;
  title: string;
  description?: string;
  dueAt?: string;
  completedAt?: string;
  statusChangedAt?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  createdAt: string;
  updatedAt: string;
  subtasks?: Subtask[];
};

type EditableSubtask = {
  id: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  isDeleted?: boolean;
};

type TaskDetailsScreenProps = {
  route: any;
  navigation: any;
  onUnauthorized?: () => void;
};

export default function TaskDetailsScreen({ route, navigation, onUnauthorized }: TaskDetailsScreenProps) {
  const { colors } = useTheme();
  const { currentTheme } = useThemePreference();
  const isDark = currentTheme === 'dark';
  const taskId = route.params?.task?.id || route.params?.taskId;
  const [task, setTask] = useState<Task | null>(route.params?.task || null);
  const [loading, setLoading] = useState(false);
  const [loadingTask, setLoadingTask] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Editable fields
  const [editTitle, setEditTitle] = useState(task?.title || '');
  const [editDescription, setEditDescription] = useState(task?.description || '');
  const [editPriority, setEditPriority] = useState(task?.priority || 'MEDIUM');
  const [editSubtasks, setEditSubtasks] = useState<EditableSubtask[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time'>('date');
  const [localDueAtIso, setLocalDueAtIso] = useState<string>(task?.dueAt || '');
  const [savingDueAt, setSavingDueAt] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const modalTranslateY = useRef(new Animated.Value(40)).current;
  const primaryActionScale = useRef(new Animated.Value(1)).current;
  const secondaryActionScale = useRef(new Animated.Value(1)).current;
  const deleteActionScale = useRef(new Animated.Value(1)).current;

  const backgroundGradient = isDark
    ? (['#0B1220', '#121A2B'] as const)
    : (['#F8FAFF', '#EEF3FB'] as const);

  const elevatedSurface = isDark ? 'rgba(17, 27, 44, 0.9)' : 'rgba(255, 255, 255, 0.92)';
  const cardBorder = isDark ? 'rgba(99, 124, 160, 0.26)' : 'rgba(0, 74, 173, 0.1)';

  const animateActionScale = (value: Animated.Value, toValue: number) => {
    Animated.spring(value, {
      toValue,
      tension: 220,
      friction: 18,
      useNativeDriver: true,
    }).start();
  };

  const handleUnauthorized = () => {
    if (onUnauthorized) {
      onUnauthorized();
      return;
    }

    Alert.alert('Session expired', 'Please log in again.', [
      {
        text: 'OK',
        onPress: () => navigation.goBack(),
      },
    ]);
  };

  const refreshTask = async () => {
    if (!taskId) {
      setScreenError('Task not found');
      setTask(null);
      return;
    }

    try {
      setLoadingTask(true);
      setScreenError(null);
      const freshTask = await getTaskById(taskId);
      setTask(freshTask as Task);
    } catch (error: any) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          handleUnauthorized();
          return;
        }

        if (error.status === 404) {
          setTask(null);
          setScreenError('Task not found');
          return;
        }
      }

      setScreenError(getUserFriendlyErrorMessage(error, 'Failed to load task details'));
    } finally {
      setLoadingTask(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      void refreshTask();
    }, [taskId])
  );

  useEffect(() => {
    if (task) {
      setEditTitle(task.title);
      setEditDescription(task.description || '');
      setEditPriority(task.priority || 'MEDIUM');
      setEditSubtasks(task.subtasks?.map(st => ({ ...st, isDeleted: false })) || []);
      setLocalDueAtIso(task.dueAt || '');
    }
  }, [task]);

  // Format date helper
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'None';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'None';

    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Format relative date helper
  const formatRelativeDate = (dueDate?: string) => {
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
      return `${diffDays} days remaining`;
    }
  };

  const withDefaultTime = (date: Date): Date => {
    const normalized = new Date(date);
    normalized.setHours(23, 59, 0, 0);
    return normalized;
  };

  const persistDueAt = async (nextDueAt: string | null) => {
    if (!task) return;

    try {
      setSavingDueAt(true);
      const updatedTask = await updateTask(task.id, { dueAt: nextDueAt });
      setTask(updatedTask as Task);
      setLocalDueAtIso(updatedTask?.dueAt || '');
    } catch (error: unknown) {
      Alert.alert('Error', getUserFriendlyErrorMessage(error, 'Failed to update due date'));
    } finally {
      setSavingDueAt(false);
    }
  };

  const commitDueAt = async (date: Date) => {
    const normalized = new Date(date);
    normalized.setSeconds(0, 0);
    const nextIso = normalized.toISOString();
    setSelectedDate(normalized);
    setLocalDueAtIso(nextIso);
    await persistDueAt(nextIso);
  };

  const clearDueAt = async () => {
    setLocalDueAtIso('');
    setSelectedDate(new Date());
    await persistDueAt(null);
    setShowDatePicker(false);
    setDatePickerMode('date');
  };

  const openAndroidTimePicker = (baseDate: Date) => {
    DateTimePickerAndroid.open({
      value: baseDate,
      mode: 'time',
      is24Hour: false,
      onChange: async (event, timeValue) => {
        if (event.type === 'set' && timeValue) {
          const withTime = new Date(baseDate);
          withTime.setHours(timeValue.getHours(), timeValue.getMinutes(), 0, 0);
          await commitDueAt(withTime);
          return;
        }

        await commitDueAt(baseDate);
      },
    });
  };

  const openDatePicker = () => {
    const parsedDueDate = localDueAtIso ? new Date(localDueAtIso) : new Date();
    const baseDate = Number.isNaN(parsedDueDate.getTime()) ? new Date() : parsedDueDate;
    const defaultedDate = localDueAtIso ? baseDate : withDefaultTime(baseDate);

    setSelectedDate(defaultedDate);

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: defaultedDate,
        mode: 'date',
        display: 'calendar',
        onChange: (event, selectedDateValue) => {
          if (event.type !== 'set' || !selectedDateValue) return;
          const selectedWithDefaultTime = localDueAtIso
            ? new Date(selectedDateValue)
            : withDefaultTime(selectedDateValue);
          setSelectedDate(selectedWithDefaultTime);
          openAndroidTimePicker(selectedWithDefaultTime);
        },
      });
      return;
    }

    setDatePickerMode('date');
    setShowDatePicker(true);

    if (Platform.OS === 'ios') {
      modalOpacity.setValue(0);
      modalTranslateY.setValue(40);
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(modalOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.timing(modalTranslateY, { toValue: 0, duration: 220, useNativeDriver: true }),
        ]).start();
      });
    }
  };

  const closeDatePicker = () => {
    if (Platform.OS === 'ios') {
      Animated.parallel([
        Animated.timing(modalOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(modalTranslateY, { toValue: 40, duration: 180, useNativeDriver: true }),
      ]).start(() => {
        setShowDatePicker(false);
        setDatePickerMode('date');
      });
      return;
    }

    setShowDatePicker(false);
    setDatePickerMode('date');
  };

  const handleToday = () => {
    const today = withDefaultTime(new Date());
    setSelectedDate(today);
  };

  const handleTomorrow = () => {
    const tomorrow = withDefaultTime(new Date());
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedDate(tomorrow);
  };

  const onDateChange = (event: any, date?: Date) => {
    if (Platform.OS !== 'ios') return;
    if (event.type !== 'set' || !date) return;

    const updatedDate = new Date(selectedDate);
    if (datePickerMode === 'date') {
      updatedDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
      if (!localDueAtIso) {
        updatedDate.setHours(23, 59, 0, 0);
      }
    } else {
      updatedDate.setHours(date.getHours(), date.getMinutes(), 0, 0);
    }

    setSelectedDate(updatedDate);
  };

  // Get priority color
  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'URGENT':
        return '#B91C1C';
      case 'HIGH':
        return '#EA580C';
      case 'MEDIUM':
        return '#004AAD';
      case 'LOW':
        return '#6B7280';
      default:
        return '#9CA3AF';
    }
  };

  // Get priority background color
  const getPriorityBgColor = (priority?: string) => {
    switch (priority) {
      case 'URGENT':
        return isDark ? 'rgba(185, 28, 28, 0.24)' : 'rgba(185, 28, 28, 0.13)';
      case 'HIGH':
        return isDark ? 'rgba(234, 88, 12, 0.24)' : 'rgba(234, 88, 12, 0.13)';
      case 'MEDIUM':
        return isDark ? 'rgba(0, 74, 173, 0.24)' : 'rgba(0, 74, 173, 0.13)';
      case 'LOW':
        return isDark ? 'rgba(107, 114, 128, 0.24)' : 'rgba(107, 114, 128, 0.12)';
      default:
        return isDark ? 'rgba(156, 163, 175, 0.24)' : 'rgba(156, 163, 175, 0.12)';
    }
  };

  const getDueTone = () => {
    if (!localDueAtIso) {
      return {
        cardBg: isDark ? 'rgba(16, 27, 43, 0.82)' : 'rgba(246, 250, 255, 0.92)',
        iconBg: isDark ? 'rgba(0, 74, 173, 0.24)' : 'rgba(0, 74, 173, 0.12)',
        border: cardBorder,
        iconColor: '#004AAD',
      };
    }

    const due = new Date(localDueAtIso);
    const overdue = !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
    if (overdue) {
      return {
        cardBg: isDark ? 'rgba(127, 29, 29, 0.22)' : 'rgba(251, 191, 36, 0.16)',
        iconBg: isDark ? 'rgba(217, 119, 6, 0.26)' : 'rgba(217, 119, 6, 0.14)',
        border: isDark ? 'rgba(217, 119, 6, 0.34)' : 'rgba(217, 119, 6, 0.22)',
        iconColor: '#C2410C',
      };
    }

    return {
      cardBg: isDark ? 'rgba(16, 27, 43, 0.84)' : 'rgba(246, 250, 255, 0.94)',
      iconBg: isDark ? 'rgba(0, 74, 173, 0.24)' : 'rgba(0, 74, 173, 0.12)',
      border: cardBorder,
      iconColor: '#004AAD',
    };
  };

  // Update subtask in edit mode
  const updateEditSubtask = (index: number, field: 'title' | 'description', value: string) => {
    setEditSubtasks(prev => prev.map((st, i) => 
      i === index ? { ...st, [field]: value } : st
    ));
  };

  // Mark subtask for deletion
  const markSubtaskForDeletion = (index: number) => {
    Alert.alert(
      'Delete Subtask',
      'Are you sure you want to delete this subtask?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setEditSubtasks(prev => prev.map((st, i) => 
              i === index ? { ...st, isDeleted: true } : st
            ));
          },
        },
      ]
    );
  };

  // Add new subtask
  const addNewSubtask = () => {
    setEditSubtasks(prev => [
      ...prev,
      {
        id: `temp_${Date.now()}`, // Temporary ID for new subtasks
        title: '',
        description: '',
        status: 'TODO',
        isDeleted: false,
      },
    ]);
  };

  // Save changes
  const saveChanges = async () => {
    if (!task) return;

    if (!editTitle.trim()) {
      Alert.alert('Error', 'Task title cannot be empty');
      return;
    }

    // Validate subtasks
    const validSubtasks = editSubtasks.filter(st => !st.isDeleted);
    for (const subtask of validSubtasks) {
      if (!subtask.title.trim()) {
        Alert.alert('Error', 'All subtasks must have a title');
        return;
      }
    }

    try {
      setLoading(true);

      // Use shared update helper so sync hooks stay centralized.
      await updateTask(task.id, {
        title: editTitle,
        description: editDescription,
        priority: editPriority,
      });

      // Update or delete existing subtasks
      for (const subtask of editSubtasks) {
        if (subtask.id.startsWith('temp_')) continue; // Skip new subtasks for now

        if (subtask.isDeleted) {
          await deleteSubtaskById(subtask.id);
        } else {
          await updateSubtaskById(subtask.id, {
            title: subtask.title,
            description: subtask.description,
          });
        }
      }

      // Create new subtasks
      const newSubtasks = editSubtasks.filter(st => st.id.startsWith('temp_') && !st.isDeleted);
      for (const subtask of newSubtasks) {
        await createSubtaskForTask(task.id, {
          title: subtask.title,
          description: subtask.description,
        });
      }

      await refreshTask();

      setIsEditing(false);
      Alert.alert('Success', 'Changes have been saved.');
      navigation.navigate('Main', {
        screen: 'Home',
        params: {
          refresh: true,
          updatedAt: Date.now(),
        },
      });
    } catch (error) {
      logger.warn('Task update failed');
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      Alert.alert('Error', getUserFriendlyErrorMessage(error, 'Failed to update task'));
    } finally {
      setLoading(false);
    }
  };

  // Toggle task status
  const toggleTaskStatus = async () => {
    if (!task) return;

    try {
      setLoading(true);
      const newStatus = task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED';
      const completedAt = newStatus === 'COMPLETED' ? new Date().toISOString() : undefined;

      const updated = await updateTask(task.id, { status: newStatus, completedAt });
      setTask(updated as Task);
      
      if (newStatus === 'COMPLETED') {
        navigation.navigate('Main', {
          screen: 'Home',
          params: {
            completionEventId: `${task.id}:${Date.now()}`,
          },
        });
      } else {
        Alert.alert('Success', `Task marked as ${newStatus.toLowerCase()}`);
      }
    } catch (error) {
      logger.warn('Task status toggle failed');
      Alert.alert('Error', 'Failed to update task status');
    } finally {
      setLoading(false);
    }
  };

  // Delete task
  const deleteTask = async () => {
    if (!task) return;

    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              // Use shared delete helper so sync hooks stay centralized.
              await deleteTaskById(task.id);
              Alert.alert('Success', 'Task deleted successfully', [
                {
                  text: 'OK',
                  onPress: () => navigation.goBack(),
                },
              ]);
            } catch (error) {
              logger.warn('Task deletion failed');
              Alert.alert('Error', 'Failed to delete task');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Toggle subtask completion
  const toggleSubtask = async (subtaskId: string, currentStatus: Subtask['status']) => {
    try {
      const newStatus: Subtask['status'] = currentStatus === 'COMPLETED' ? 'TODO' : 'COMPLETED';
      const completedAt = newStatus === 'COMPLETED' ? new Date().toISOString() : undefined;

      const previousStatus = task?.status;
      const updateResult = await updateSubtaskById(subtaskId, { status: newStatus, completedAt });
      const nextTask = updateResult.task ? (updateResult.task as Task) : ((await getTaskById(task!.id)) as Task);
      setTask(nextTask);

      if (nextTask.status === 'COMPLETED' && previousStatus !== 'COMPLETED') {
        navigation.navigate('Main', {
          screen: 'Home',
          params: {
            completionEventId: `${nextTask.id}:${Date.now()}`,
          },
        });
      }
    } catch (error) {
      logger.warn('Subtask toggle failed');
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized();
        return;
      }
      Alert.alert('Error', getUserFriendlyErrorMessage(error, 'Failed to update subtask'));
    }
  };

  if (loadingTask && !task) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.errorText, { color: colors.text, marginTop: 12 }]}>Loading task...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (screenError && !task) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="cloud-off" size={64} color="#D1D5DB" />
          <Text style={styles.errorText}>{screenError}</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => {
              void refreshTask();
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.errorButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!task) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color="#D1D5DB" />
          <Text style={styles.errorText}>Task not found</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
      {/* Header - Card-like with soft background, no harsh border */}
      <View
        style={[
          styles.headerContainer,
          {
            backgroundColor: elevatedSurface,
            borderBottomColor: cardBorder,
            shadowColor: isDark ? '#020617' : '#8EADE0',
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: isDark ? 'rgba(21, 32, 51, 0.92)' : '#FFFFFF', borderColor: cardBorder }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Task Details</Text>
        <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: isDark ? 'rgba(21, 32, 51, 0.92)' : '#FFFFFF', borderColor: cardBorder }]}
          onPress={() => {
            if (isEditing) {
              // Cancel editing - reset to original values
              setEditTitle(task.title);
              setEditDescription(task.description || '');
              setEditPriority(task.priority || 'MEDIUM');
              setEditSubtasks(task.subtasks?.map(st => ({ ...st, isDeleted: false })) || []);
            }
            setIsEditing(!isEditing);
          }}
          activeOpacity={0.7}
        >
          <MaterialIcons 
            name={isEditing ? 'close' : 'edit'} 
            size={22} 
            color={colors.text} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* Task Title Section */}
        <View style={[styles.titleSection, styles.surfaceCard, { backgroundColor: elevatedSurface, borderColor: cardBorder, shadowColor: isDark ? '#020617' : '#8EADE0' }]}>
          {isEditing ? (
            <TextInput
              style={[
                styles.titleInput,
                {
                  color: colors.text,
                  backgroundColor: isDark ? 'rgba(15, 25, 40, 0.86)' : 'rgba(248, 251, 255, 0.96)',
                  borderColor: focusedField === 'title' ? `${colors.primary}88` : cardBorder,
                },
              ]}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Task title"
              placeholderTextColor={colors.mutedText}
              onFocus={() => setFocusedField('title')}
              onBlur={() => setFocusedField(null)}
            />
          ) : (
            <Text style={[styles.taskTitle, { color: colors.text }]}>{task.title}</Text>
          )}
          
          {/* Priority Badge or Selector */}
          {isEditing ? (
            <View style={styles.prioritySelector}>
              <Text style={styles.selectorLabel}>Priority</Text>
              <View style={styles.priorityButtons}>
                {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map((priority) => (
                  <TouchableOpacity
                    key={priority}
                    style={[
                      styles.priorityButton,
                      {
                        borderColor: cardBorder,
                        backgroundColor: isDark ? 'rgba(15, 25, 40, 0.86)' : 'rgba(248, 251, 255, 0.96)',
                      },
                      editPriority === priority && {
                        backgroundColor: getPriorityBgColor(priority),
                        borderColor: getPriorityColor(priority),
                        borderWidth: 1.3,
                        shadowColor: getPriorityColor(priority),
                        shadowOpacity: 0.16,
                        shadowRadius: 6,
                        shadowOffset: { width: 0, height: 3 },
                        elevation: 2,
                      },
                    ]}
                    onPress={() => setEditPriority(priority)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.priorityButtonText,
                        { color: colors.mutedText },
                        editPriority === priority && {
                          color: getPriorityColor(priority),
                          fontWeight: '700',
                        },
                      ]}
                    >
                      {priority}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            task.priority && (
              <View
                style={[
                  styles.priorityBadge,
                  {
                    backgroundColor: getPriorityBgColor(task.priority),
                    borderColor: `${getPriorityColor(task.priority)}44`,
                  },
                ]}
              >
                <View
                  style={[
                    styles.priorityDot,
                    { backgroundColor: getPriorityColor(task.priority) },
                  ]}
                />
                <Text
                  style={[
                    styles.priorityText,
                    { color: getPriorityColor(task.priority) },
                  ]}
                >
                  {task.priority} Priority
                </Text>
              </View>
            )
          )}
        </View>

        {/* Status Badge */}
        {!isEditing && (
          <View
            style={[
              styles.statusBadge,
              { borderColor: task.status === 'COMPLETED' ? `${colors.success}46` : `${colors.primary}46` },
              task.status === 'COMPLETED'
                ? styles.statusCompleted
                : styles.statusActive,
            ]}
          >
            <MaterialIcons
              name={task.status === 'COMPLETED' ? 'check-circle' : 'radio-button-unchecked'}
              size={18}
              color={task.status === 'COMPLETED' ? '#00C853' : '#004AAD'}
            />
            <Text
              style={[
                styles.statusText,
                task.status === 'COMPLETED'
                  ? styles.statusTextCompleted
                  : styles.statusTextActive,
              ]}
            >
              {task.status}
            </Text>
          </View>
        )}

        {/* Description Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Description</Text>
          {isEditing ? (
            <TextInput
              style={[
                styles.descriptionInput,
                {
                  color: colors.text,
                  backgroundColor: isDark ? 'rgba(15, 25, 40, 0.86)' : 'rgba(248, 251, 255, 0.96)',
                  borderColor: focusedField === 'description' ? `${colors.primary}88` : cardBorder,
                },
              ]}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Add a description..."
              placeholderTextColor={colors.mutedText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              onFocus={() => setFocusedField('description')}
              onBlur={() => setFocusedField(null)}
            />
          ) : (
            <View style={[styles.sectionCard, styles.surfaceCard, { backgroundColor: elevatedSurface, borderColor: cardBorder, shadowColor: isDark ? '#020617' : '#8EADE0' }]}>
              <Text style={[styles.descriptionText, { color: colors.text }]}>
                {task.description || 'No description provided'}
              </Text>
            </View>
          )}
        </View>

        {/* Due Date Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Due Date</Text>
          {isEditing ? (
            <TouchableOpacity
              style={[
                styles.infoCard,
                {
                  backgroundColor: getDueTone().cardBg,
                  borderColor: getDueTone().border,
                  shadowColor: isDark ? '#020617' : '#8EADE0',
                },
              ]}
              onPress={openDatePicker}
              activeOpacity={0.8}
              disabled={savingDueAt}
            >
              <View style={[styles.iconContainer, { backgroundColor: getDueTone().iconBg }] }>
                <MaterialIcons name="event" size={20} color={getDueTone().iconColor} />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoMainText, { color: colors.text }]}>{localDueAtIso ? formatRelativeDate(localDueAtIso) : 'No due date'}</Text>
                <Text style={[styles.infoSubText, { color: colors.mutedText }]}>{formatDate(localDueAtIso || undefined)}</Text>
              </View>
              <View style={styles.dueRightActions}>
                {localDueAtIso ? (
                  <TouchableOpacity
                    style={[styles.clearDueButton, { backgroundColor: isDark ? 'rgba(15, 25, 40, 0.9)' : '#EFF5FF' }]}
                    onPress={(event) => {
                      event.stopPropagation();
                      clearDueAt();
                    }}
                    disabled={savingDueAt}
                  >
                      <MaterialIcons name="close" size={15} color={colors.mutedText} />
                  </TouchableOpacity>
                ) : null}
                {savingDueAt ? (
                  <ActivityIndicator size="small" color="#6B7280" />
                ) : null}
              </View>
            </TouchableOpacity>
          ) : (
            <View
              style={[
                styles.infoCard,
                {
                  backgroundColor: getDueTone().cardBg,
                  borderColor: getDueTone().border,
                  shadowColor: isDark ? '#020617' : '#8EADE0',
                },
              ]}
            >
              <View style={[styles.iconContainer, { backgroundColor: getDueTone().iconBg }] }>
                <MaterialIcons name="event" size={20} color={getDueTone().iconColor} />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoMainText, { color: colors.text }]}>{localDueAtIso ? formatRelativeDate(localDueAtIso) : 'No due date'}</Text>
                <Text style={[styles.infoSubText, { color: colors.mutedText }]}>{formatDate(localDueAtIso || undefined)}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Subtasks Section */}
        {(isEditing || (!isEditing && task.subtasks && task.subtasks.length > 0)) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Subtasks</Text>
              {!isEditing && (
                <Text style={[styles.subtaskCount, { color: colors.mutedText }]}> 
                  {task.subtasks?.filter((st) => st.status === 'COMPLETED').length}/{task.subtasks?.length} completed
                </Text>
              )}
            </View>

            {isEditing ? (
              <>
                {editSubtasks.filter(st => !st.isDeleted).map((subtask, index) => (
                  <View
                    key={subtask.id}
                    style={[
                      styles.editSubtaskCard,
                      {
                        backgroundColor: elevatedSurface,
                        borderColor: cardBorder,
                        shadowColor: isDark ? '#020617' : '#8EADE0',
                      },
                    ]}
                  >
                    <View style={styles.editSubtaskInputs}>
                      <TextInput
                        style={[
                          styles.subtaskTitleInput,
                          {
                            color: colors.text,
                            borderColor: focusedField === `subtask-title-${index}` ? `${colors.primary}88` : cardBorder,
                            backgroundColor: isDark ? 'rgba(15, 25, 40, 0.86)' : 'rgba(248, 251, 255, 0.96)',
                          },
                        ]}
                        value={subtask.title}
                        onChangeText={(text) => updateEditSubtask(index, 'title', text)}
                        placeholder="Subtask title"
                        placeholderTextColor={colors.mutedText}
                        onFocus={() => setFocusedField(`subtask-title-${index}`)}
                        onBlur={() => setFocusedField(null)}
                      />
                      <TextInput
                        style={[
                          styles.subtaskDescriptionInput,
                          {
                            color: colors.text,
                            borderColor: focusedField === `subtask-desc-${index}` ? `${colors.primary}88` : cardBorder,
                            backgroundColor: isDark ? 'rgba(15, 25, 40, 0.86)' : 'rgba(248, 251, 255, 0.96)',
                          },
                        ]}
                        value={subtask.description || ''}
                        onChangeText={(text) => updateEditSubtask(index, 'description', text)}
                        placeholder="Subtask description (optional)"
                        placeholderTextColor={colors.mutedText}
                        multiline
                        onFocus={() => setFocusedField(`subtask-desc-${index}`)}
                        onBlur={() => setFocusedField(null)}
                      />
                    </View>
                    <TouchableOpacity
                      style={[styles.deleteSubtaskButton, { backgroundColor: isDark ? 'rgba(153, 27, 27, 0.22)' : 'rgba(255, 77, 77, 0.12)' }]}
                      onPress={() => markSubtaskForDeletion(index)}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="delete-outline" size={20} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
                
                <TouchableOpacity
                  style={[styles.addSubtaskButton, { backgroundColor: elevatedSurface, borderColor: `${colors.primary}80` }]}
                  onPress={addNewSubtask}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="add-circle-outline" size={20} color={colors.primary} />
                  <Text style={[styles.addSubtaskText, { color: colors.primary }]}>Add Subtask</Text>
                </TouchableOpacity>
              </>
            ) : (
              task.subtasks?.map((subtask) => (
                <TouchableOpacity
                  key={subtask.id}
                  style={[
                    styles.subtaskCard,
                    {
                      backgroundColor:
                        subtask.status === 'COMPLETED'
                          ? isDark
                            ? 'rgba(34, 197, 94, 0.14)'
                            : 'rgba(34, 197, 94, 0.1)'
                          : elevatedSurface,
                      borderColor:
                        subtask.status === 'COMPLETED'
                          ? `${colors.success}44`
                          : cardBorder,
                      shadowColor: isDark ? '#020617' : '#8EADE0',
                    },
                  ]}
                  onPress={() => toggleSubtask(subtask.id, subtask.status)}
                  activeOpacity={0.83}
                >
                  <View style={styles.subtaskCheckbox}>
                    <MaterialIcons
                      name={subtask.status === 'COMPLETED' ? 'check-circle' : 'radio-button-unchecked'}
                      size={24}
                      color={subtask.status === 'COMPLETED' ? '#00C853' : '#9CA3AF'}
                    />
                  </View>
                  <View style={styles.subtaskContent}>
                    <Text
                      style={[
                        styles.subtaskTitle,
                        { color: colors.text },
                        subtask.status === 'COMPLETED' && styles.subtaskTitleCompleted,
                      ]}
                    >
                      {subtask.title}
                    </Text>
                    {subtask.description && (
                      <Text style={[styles.subtaskDescription, { color: colors.mutedText }]}>{subtask.description}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Task Metadata Section */}
        {!isEditing && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Task Information</Text>
            <View style={[styles.metadataCard, styles.surfaceCard, { backgroundColor: elevatedSurface, borderColor: cardBorder, shadowColor: isDark ? '#020617' : '#8EADE0' }]}>
              <View style={styles.metadataItem}>
                <MaterialIcons name="schedule" size={18} color={colors.mutedText} />
                <Text style={[styles.metadataLabel, { color: colors.mutedText }]}>Created</Text>
                <Text style={[styles.metadataValue, { color: colors.text }]}>
                  {new Date(task.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              </View>
              <View style={[styles.metadataDivider, { backgroundColor: cardBorder }]} />
              <View style={styles.metadataItem}>
                <MaterialIcons name="update" size={18} color={colors.mutedText} />
                <Text style={[styles.metadataLabel, { color: colors.mutedText }]}>Last Updated</Text>
                <Text style={[styles.metadataValue, { color: colors.text }]}>
                  {new Date(task.updatedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Action Buttons Section */}
        <View style={styles.actionsSection}>
          {isEditing ? (
            <Animated.View style={{ transform: [{ scale: primaryActionScale }] }}>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonPrimary]}
                onPress={saveChanges}
                disabled={loading}
                activeOpacity={0.82}
                onPressIn={() => animateActionScale(primaryActionScale, 0.975)}
                onPressOut={() => animateActionScale(primaryActionScale, 1)}
              >
                <LinearGradient
                  colors={['#0A5DCD', '#004AAD']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.actionGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <MaterialIcons name="save" size={20} color="#FFFFFF" />
                      <Text style={styles.actionButtonText}>Save Changes</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <>
              <Animated.View style={{ transform: [{ scale: secondaryActionScale }] }}>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    task.status === 'COMPLETED' ? styles.actionButtonSecondary : styles.actionButtonPrimary,
                    task.status === 'COMPLETED' && { borderColor: cardBorder, backgroundColor: elevatedSurface },
                  ]}
                  onPress={toggleTaskStatus}
                  disabled={loading}
                  activeOpacity={0.82}
                  onPressIn={() => animateActionScale(secondaryActionScale, 0.975)}
                  onPressOut={() => animateActionScale(secondaryActionScale, 1)}
                >
                  {task.status === 'COMPLETED' ? null : (
                    <LinearGradient
                      colors={['#0A5DCD', '#004AAD']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.actionGradient}
                    />
                  )}
                  {loading ? (
                    <ActivityIndicator color={task.status === 'COMPLETED' ? colors.text : '#FFFFFF'} />
                  ) : (
                    <>
                      <MaterialIcons
                        name={task.status === 'COMPLETED' ? 'undo' : 'check-circle'}
                        size={20}
                        color={task.status === 'COMPLETED' ? colors.text : '#FFFFFF'}
                      />
                      <Text
                        style={[
                          styles.actionButtonText,
                          task.status === 'COMPLETED' && { color: colors.text },
                        ]}
                      >
                        {task.status === 'COMPLETED' ? 'Mark as Active' : 'Mark as Completed'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={{ transform: [{ scale: deleteActionScale }] }}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonDelete]}
                  onPress={deleteTask}
                  disabled={loading}
                  activeOpacity={0.82}
                  onPressIn={() => animateActionScale(deleteActionScale, 0.975)}
                  onPressOut={() => animateActionScale(deleteActionScale, 1)}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <MaterialIcons name="delete" size={20} color="#FFFFFF" />
                      <Text style={styles.actionButtonText}>Delete Task</Text>
                    </>
                  )}
                </TouchableOpacity>
              </Animated.View>
            </>
          )}
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 24 }} />
      </ScrollView>

      {Platform.OS === 'ios' && showDatePicker && (
        <Modal transparent animationType="none" visible onRequestClose={closeDatePicker}>
          <View style={styles.modalRoot}>
            <Pressable onPress={closeDatePicker} style={styles.modalBackdropPressable}>
              <Animated.View style={[styles.modalBackdrop, { opacity: modalOpacity }]} />
            </Pressable>
            <Animated.View
              style={[
                styles.dateSheet,
                { backgroundColor: colors.surface, borderTopColor: colors.border },
                { opacity: modalOpacity, transform: [{ translateY: modalTranslateY }] },
              ]}
            >
              <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}> 
                <TouchableOpacity onPress={clearDueAt}>
                  <Text style={[styles.sheetActionText, { color: colors.danger }]}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleToday}>
                  <Text style={[styles.sheetActionText, { color: colors.primary }]}>Today</Text>
                </TouchableOpacity>
                {datePickerMode === 'date' ? (
                  <TouchableOpacity onPress={() => setDatePickerMode('time')}>
                    <Text style={[styles.sheetActionText, { color: colors.primary }]}>Next</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={async () => {
                      await commitDueAt(selectedDate);
                      closeDatePicker();
                    }}
                  >
                    <Text style={[styles.sheetActionText, { color: colors.primary }]}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.datePickerContainer}>
                <DateTimePicker
                  value={selectedDate}
                  mode={datePickerMode}
                  display="spinner"
                  onChange={onDateChange}
                  minimumDate={datePickerMode === 'date' ? new Date() : undefined}
                  textColor={colors.text}
                  style={styles.datePicker}
                />
              </View>
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* QA checklist:
          1) Existing dueAt task -> tap due date -> change date/time -> persisted and shown immediately.
          2) No dueAt task -> tap due date -> select date only -> defaults to 23:59 local if time not changed.
          3) Clear in iOS sheet -> dueAt becomes null and UI shows None.
          4) Calendar date dots/task grouping move after returning to Calendar (focus refresh).
          5) Home list reflects updated due time after returning (focus refresh).
      */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Container
  container: {
    flex: 1,
    backgroundColor: '#F8FAFF',
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
    right: -74,
  },
  backgroundBlobBottom: {
    width: 170,
    height: 170,
    bottom: 120,
    left: -56,
  },

  // Error State
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 20,
    marginBottom: 24,
  },
  errorButton: {
    backgroundColor: '#004AAD',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Header - Card-like with soft background, subtle shadow
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  surfaceCard: {
    borderWidth: 1,
    borderRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },

  // Title Section
  titleSection: {
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  taskTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 10,
    lineHeight: 30,
  },
  titleInput: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  // Priority Selector (Edit Mode)
  prioritySelector: {
    marginTop: 6,
  },
  selectorLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  priorityButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  priorityButton: {
    minWidth: '22%',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
  },
  priorityButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },

  // Priority Badge (View Mode)
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  priorityText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Status Badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    marginBottom: 14,
    borderWidth: 1,
  },
  statusActive: {
    backgroundColor: 'rgba(0, 74, 173, 0.12)',
  },
  statusCompleted: {
    backgroundColor: 'rgba(0, 200, 83, 0.1)',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  statusTextActive: {
    color: '#004AAD',
  },
  statusTextCompleted: {
    color: '#00C853',
  },

  // Sections
  section: {
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 9,
  },
  subtaskCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },

  // Section Cards (Description, Info, Metadata)
  sectionCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  descriptionText: {
    fontSize: 15,
    color: '#1F2937',
    lineHeight: 24,
  },
  descriptionInput: {
    fontSize: 15,
    lineHeight: 24,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    minHeight: 112,
  },

  // Info Card (Due Date)
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  infoContent: {
    flex: 1,
  },
  dueRightActions: {
    marginLeft: 10,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearDueButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoMainText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  infoSubText: {
    fontSize: 14,
    color: '#6B7280',
  },

  // Subtasks (View Mode)
  subtaskCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 15,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  subtaskCheckbox: {
    marginRight: 14,
    marginTop: 1,
  },
  subtaskContent: {
    flex: 1,
  },
  subtaskTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    lineHeight: 22,
  },
  subtaskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  subtaskDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },

  // Subtasks (Edit Mode)
  editSubtaskCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 15,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  editSubtaskInputs: {
    flex: 1,
    marginRight: 12,
  },
  subtaskTitleInput: {
    fontSize: 15,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  subtaskDescriptionInput: {
    fontSize: 14,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  deleteSubtaskButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  addSubtaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.2,
    borderColor: '#004AAD',
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addSubtaskText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#004AAD',
    marginLeft: 8,
  },

  // Metadata Card
  metadataCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  metadataDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 4,
  },
  metadataLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 12,
    flex: 1,
  },
  metadataValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },

  // Action Buttons
  actionsSection: {
    marginTop: 6,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  actionButtonPrimary: {
    backgroundColor: '#004AAD',
  },
  actionButtonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionButtonDelete: {
    backgroundColor: '#FF4D4D',
  },
  actionGradient: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 10,
  },
  actionButtonTextSecondary: {
    color: '#1F2937',
  },

  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  dateSheet: {
    borderTopWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 16,
    paddingTop: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  sheetActionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  datePickerContainer: {
    alignItems: 'center',
    paddingTop: 8,
  },
  datePicker: {
    width: '100%',
  },
});