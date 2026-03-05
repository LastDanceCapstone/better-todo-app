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
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useTheme } from '../theme';
import { updateTask } from '../config/api';

import { updateEventForTask, deleteEventForTask } from '../services/appleCalendar';

const API_BASE_URL = 'https://prioritize-production-3835.up.railway.app';

async function syncCalendarForTask(task: { id: string; title: string; dueAt?: string | null; status?: string }) {
  try {
    const active = task.status !== 'COMPLETED' && task.status !== 'CANCELLED';
    if (task.dueAt && active) {
      await updateEventForTask(task.id, task.title, task.dueAt);
    } else {
      await deleteEventForTask(task.id);
    }
  } catch (_) {}
}

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

export default function TaskDetailsScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const [task, setTask] = useState<Task | null>(route.params?.task || null);
  const [loading, setLoading] = useState(false);
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
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const modalTranslateY = useRef(new Animated.Value(40)).current;

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
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'Failed to update due date');
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
      case 'HIGH':
        return '#FF4D4D';
      case 'MEDIUM':
        return '#FFB800';
      case 'LOW':
        return '#00C853';
      default:
        return '#9CA3AF';
    }
  };

  // Get priority background color
  const getPriorityBgColor = (priority?: string) => {
    switch (priority) {
      case 'HIGH':
        return 'rgba(255, 77, 77, 0.1)';
      case 'MEDIUM':
        return 'rgba(255, 184, 0, 0.1)';
      case 'LOW':
        return 'rgba(0, 200, 83, 0.1)';
      default:
        return 'rgba(156, 163, 175, 0.1)';
    }
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
      const token = await AsyncStorage.getItem('authToken');
      
      if (!token) {
        Alert.alert('Error', 'No authentication token found');
        return;
      }

      // Update main task
      const response = await fetch(`${API_BASE_URL}/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          priority: editPriority,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update task');
      }

      // Update or delete existing subtasks
      for (const subtask of editSubtasks) {
        if (subtask.id.startsWith('temp_')) continue; // Skip new subtasks for now

        if (subtask.isDeleted) {
          // Delete subtask
          await fetch(`${API_BASE_URL}/api/subtasks/${subtask.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
        } else {
          // Update subtask
          await fetch(`${API_BASE_URL}/api/subtasks/${subtask.id}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: subtask.title,
              description: subtask.description,
            }),
          });
        }
      }

      // Create new subtasks
      const newSubtasks = editSubtasks.filter(st => st.id.startsWith('temp_') && !st.isDeleted);
      for (const subtask of newSubtasks) {
        await fetch(`${API_BASE_URL}/api/tasks/${task.id}/subtasks`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: subtask.title,
            description: subtask.description,
          }),
        });
      }

      // Fetch updated task
      const updatedResponse = await fetch(`${API_BASE_URL}/api/tasks/${task.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (updatedResponse.ok) {
        const data = await updatedResponse.json();
        setTask(data.task);
      }

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
      console.error('Error updating task:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update task');
    } finally {
      setLoading(false);
    }
  };

  // Toggle task status
  const toggleTaskStatus = async () => {
    if (!task) return;

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      
      if (!token) {
        Alert.alert('Error', 'No authentication token found');
        return;
      }

      const newStatus = task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED';
      const completedAt = newStatus === 'COMPLETED' ? new Date().toISOString() : undefined;

      const response = await fetch(`${API_BASE_URL}/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus, completedAt }),
      });

      if (response.ok) {
        const data = await response.json();
        setTask(data.task);
        syncCalendarForTask(data.task);
        Alert.alert('Success', `Task marked as ${newStatus.toLowerCase()}`);
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.error || 'Failed to update task');
      }
    } catch (error) {
      console.error('Error toggling task status:', error);
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
              const token = await AsyncStorage.getItem('authToken');
              
              if (!token) {
                Alert.alert('Error', 'No authentication token found');
                return;
              }

              const response = await fetch(`${API_BASE_URL}/api/tasks/${task.id}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              });

              if (response.ok) {
                deleteEventForTask(task.id).catch(() => {});
                Alert.alert('Success', 'Task deleted successfully', [
                  {
                    text: 'OK',
                    onPress: () => navigation.goBack(),
                  },
                ]);
              } else {
                const errorData = await response.json();
                Alert.alert('Error', errorData.error || 'Failed to delete task');
              }
            } catch (error) {
              console.error('Error deleting task:', error);
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
      const token = await AsyncStorage.getItem('authToken');
      
      if (!token) {
        Alert.alert('Error', 'No authentication token found');
        return;
      }

      const newStatus: Subtask['status'] = currentStatus === 'COMPLETED' ? 'TODO' : 'COMPLETED';
      const completedAt = newStatus === 'COMPLETED' ? new Date().toISOString() : undefined;

      const response = await fetch(`${API_BASE_URL}/api/subtasks/${subtaskId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus, completedAt }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.task) {
          setTask(data.task);
          return;
        }

        // Fallback update if backend does not return updated parent task
        setTask((prevTask) => {
          if (!prevTask) return null;

          const nextSubtasks = prevTask.subtasks?.map((st) =>
            st.id === subtaskId ? { ...st, status: newStatus, completedAt } : st
          );

          const allCompleted = (nextSubtasks ?? []).length > 0
            && (nextSubtasks ?? []).every((st) => st.status === 'COMPLETED');

          return {
            ...prevTask,
            status: allCompleted ? 'COMPLETED' : 'TODO',
            completedAt: allCompleted ? new Date().toISOString() : undefined,
            subtasks: nextSubtasks,
          };
        });
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.error || 'Failed to update subtask');
      }
    } catch (error) {
      console.error('Error toggling subtask:', error);
      Alert.alert('Error', 'Failed to update subtask');
    }
  };

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
      {/* Header - Card-like with soft background, no harsh border */}
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Task Details</Text>
        <TouchableOpacity
          style={styles.headerButton}
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
            size={24} 
            color="#1F2937" 
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Task Title Section */}
        <View style={styles.titleSection}>
          {isEditing ? (
            <TextInput
              style={styles.titleInput}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Task title"
              placeholderTextColor="#9CA3AF"
            />
          ) : (
            <Text style={styles.taskTitle}>{task.title}</Text>
          )}
          
          {/* Priority Badge or Selector */}
          {isEditing ? (
            <View style={styles.prioritySelector}>
              <Text style={styles.selectorLabel}>Priority</Text>
              <View style={styles.priorityButtons}>
                {(['LOW', 'MEDIUM', 'HIGH'] as const).map((priority) => (
                  <TouchableOpacity
                    key={priority}
                    style={[
                      styles.priorityButton,
                      editPriority === priority && {
                        backgroundColor: getPriorityBgColor(priority),
                        borderColor: getPriorityColor(priority),
                        borderWidth: 1.5,
                      },
                    ]}
                    onPress={() => setEditPriority(priority)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.priorityButtonText,
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
                  { backgroundColor: getPriorityBgColor(task.priority) },
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
              task.status === 'COMPLETED'
                ? styles.statusCompleted
                : styles.statusActive,
            ]}
          >
            <MaterialIcons
              name={task.status === 'COMPLETED' ? 'check-circle' : 'radio-button-unchecked'}
              size={18}
              color={task.status === 'COMPLETED' ? '#00C853' : '#2563EB'}
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
          <Text style={styles.sectionTitle}>Description</Text>
          {isEditing ? (
            <TextInput
              style={styles.descriptionInput}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Add a description..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          ) : (
            <View style={styles.sectionCard}>
              <Text style={styles.descriptionText}>
                {task.description || 'No description provided'}
              </Text>
            </View>
          )}
        </View>

        {/* Due Date Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Due Date</Text>
          {isEditing ? (
            <TouchableOpacity
              style={styles.infoCard}
              onPress={openDatePicker}
              activeOpacity={0.8}
              disabled={savingDueAt}
            >
              <View style={styles.iconContainer}>
                <MaterialIcons name="event" size={22} color="#2563EB" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoMainText}>{localDueAtIso ? formatRelativeDate(localDueAtIso) : 'No due date'}</Text>
                <Text style={styles.infoSubText}>{formatDate(localDueAtIso || undefined)}</Text>
              </View>
              <View style={styles.dueRightActions}>
                {localDueAtIso ? (
                  <TouchableOpacity
                    style={styles.clearDueButton}
                    onPress={(event) => {
                      event.stopPropagation();
                      clearDueAt();
                    }}
                    disabled={savingDueAt}
                  >
                    <MaterialIcons name="close" size={16} color="#6B7280" />
                  </TouchableOpacity>
                ) : null}
                {savingDueAt ? (
                  <ActivityIndicator size="small" color="#6B7280" />
                ) : null}
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.infoCard}>
              <View style={styles.iconContainer}>
                <MaterialIcons name="event" size={22} color="#2563EB" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoMainText}>{localDueAtIso ? formatRelativeDate(localDueAtIso) : 'No due date'}</Text>
                <Text style={styles.infoSubText}>{formatDate(localDueAtIso || undefined)}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Subtasks Section */}
        {(isEditing || (!isEditing && task.subtasks && task.subtasks.length > 0)) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Subtasks</Text>
              {!isEditing && (
                <Text style={styles.subtaskCount}>
                  {task.subtasks?.filter((st) => st.status === 'COMPLETED').length}/{task.subtasks?.length} completed
                </Text>
              )}
            </View>

            {isEditing ? (
              <>
                {editSubtasks.filter(st => !st.isDeleted).map((subtask, index) => (
                  <View key={subtask.id} style={styles.editSubtaskCard}>
                    <View style={styles.editSubtaskInputs}>
                      <TextInput
                        style={styles.subtaskTitleInput}
                        value={subtask.title}
                        onChangeText={(text) => updateEditSubtask(index, 'title', text)}
                        placeholder="Subtask title"
                        placeholderTextColor="#9CA3AF"
                      />
                      <TextInput
                        style={styles.subtaskDescriptionInput}
                        value={subtask.description || ''}
                        onChangeText={(text) => updateEditSubtask(index, 'description', text)}
                        placeholder="Subtask description (optional)"
                        placeholderTextColor="#9CA3AF"
                        multiline
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.deleteSubtaskButton}
                      onPress={() => markSubtaskForDeletion(index)}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="delete-outline" size={22} color="#FF4D4D" />
                    </TouchableOpacity>
                  </View>
                ))}
                
                <TouchableOpacity
                  style={styles.addSubtaskButton}
                  onPress={addNewSubtask}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="add-circle-outline" size={20} color="#2563EB" />
                  <Text style={styles.addSubtaskText}>Add Subtask</Text>
                </TouchableOpacity>
              </>
            ) : (
              task.subtasks?.map((subtask) => (
                <TouchableOpacity
                  key={subtask.id}
                  style={styles.subtaskCard}
                  onPress={() => toggleSubtask(subtask.id, subtask.status)}
                  activeOpacity={0.7}
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
                        subtask.status === 'COMPLETED' && styles.subtaskTitleCompleted,
                      ]}
                    >
                      {subtask.title}
                    </Text>
                    {subtask.description && (
                      <Text style={styles.subtaskDescription}>{subtask.description}</Text>
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
            <Text style={styles.sectionTitle}>Task Information</Text>
            <View style={styles.metadataCard}>
              <View style={styles.metadataItem}>
                <MaterialIcons name="schedule" size={18} color="#6B7280" />
                <Text style={styles.metadataLabel}>Created</Text>
                <Text style={styles.metadataValue}>
                  {new Date(task.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              </View>
              <View style={styles.metadataDivider} />
              <View style={styles.metadataItem}>
                <MaterialIcons name="update" size={18} color="#6B7280" />
                <Text style={styles.metadataLabel}>Last Updated</Text>
                <Text style={styles.metadataValue}>
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
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonPrimary]}
              onPress={saveChanges}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="save" size={20} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  task.status === 'COMPLETED' ? styles.actionButtonSecondary : styles.actionButtonPrimary,
                ]}
                onPress={toggleTaskStatus}
                disabled={loading}
                activeOpacity={0.7}
              >
                {loading ? (
                  <ActivityIndicator color={task.status === 'COMPLETED' ? '#1F2937' : '#FFFFFF'} />
                ) : (
                  <>
                    <MaterialIcons
                      name={task.status === 'COMPLETED' ? 'undo' : 'check-circle'}
                      size={20}
                      color={task.status === 'COMPLETED' ? '#1F2937' : '#FFFFFF'}
                    />
                    <Text
                      style={[
                        styles.actionButtonText,
                        task.status === 'COMPLETED' && styles.actionButtonTextSecondary,
                      ]}
                    >
                      {task.status === 'COMPLETED' ? 'Mark as Active' : 'Mark as Completed'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonDelete]}
                onPress={deleteTask}
                disabled={loading}
                activeOpacity={0.7}
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
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#2563EB',
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
    paddingVertical: 16,
    backgroundColor: '#F9FAFB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // Title Section
  titleSection: {
    marginBottom: 20,
  },
  taskTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    lineHeight: 36,
  },
  titleInput: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },

  // Priority Selector (Edit Mode)
  prioritySelector: {
    marginTop: 8,
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priorityButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 24,
  },
  statusActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
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
    color: '#2563EB',
  },
  statusTextCompleted: {
    color: '#00C853',
  },

  // Sections
  section: {
    marginBottom: 24,
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
    color: '#111827',
    marginBottom: 12,
  },
  subtaskCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },

  // Section Cards (Description, Info, Metadata)
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  descriptionText: {
    fontSize: 15,
    color: '#1F2937',
    lineHeight: 24,
  },
  descriptionInput: {
    fontSize: 15,
    color: '#1F2937',
    lineHeight: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    minHeight: 120,
    backgroundColor: '#FFFFFF',
  },

  // Info Card (Due Date)
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
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
    backgroundColor: '#F3F4F6',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  editSubtaskInputs: {
    flex: 1,
    marginRight: 12,
  },
  subtaskTitleInput: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
  },
  subtaskDescriptionInput: {
    fontSize: 14,
    color: '#6B7280',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
    minHeight: 60,
    backgroundColor: '#F9FAFB',
    textAlignVertical: 'top',
  },
  deleteSubtaskButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 77, 77, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  addSubtaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#2563EB',
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addSubtaskText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563EB',
    marginLeft: 8,
  },

  // Metadata Card
  metadataCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonPrimary: {
    backgroundColor: '#2563EB',
  },
  actionButtonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionButtonDelete: {
    backgroundColor: '#FF4D4D',
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