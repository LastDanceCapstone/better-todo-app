import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  Pressable,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, ApiError, createTask, getAuthToken, parseTask, type ParsedTaskResponse } from '../config/api';
import { DEFAULT_PRIORITY_KEY } from './GeneralSettingsScreen';
import AppInput from '../components/AppInput';
import AppButton from '../components/AppButton';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type Status = 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

interface SubtaskInput {
  id: string;
  title: string;
  description?: string;
}

const STATUS_META: Record<Status, { label: string; icon: keyof typeof MaterialIcons.glyphMap; helper?: string }> = {
  TODO: { label: 'To Do', icon: 'radio-button-unchecked', helper: 'Not started yet' },
  IN_PROGRESS: { label: 'In Progress', icon: 'pending', helper: 'Currently being worked on' },
  COMPLETED: { label: 'Completed', icon: 'check-circle', helper: 'All done' },
  CANCELLED: { label: 'Cancelled', icon: 'cancel', helper: 'No longer needed' },
};

// Convert user input into ISO date string for backend
const normalizeDate = (input: string): string | undefined => {
  if (!input) return undefined;

  const value = input.trim();
  if (!value) return undefined;

  // MM-DD-YYYY or M-D-YYYY (with - or /)
  const mdy = value.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (mdy) {
    const [, m, d, y] = mdy;
    const localDate = new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 0, 0);
    return localDate.toISOString();
  }

  // YYYY-MM-DD format (convert to ISO)
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day, 23, 59, 0, 0).toISOString();
  }

  // Let JS try
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return undefined;
};

const formatDateForDisplayLong = (date: Date): string =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const DATE_ONLY_ROUTE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const resolvePrefillDate = (prefillDueAtIso?: string, prefillDateIso?: string): Date | null => {
  if (prefillDueAtIso) {
    const parsed = new Date(prefillDueAtIso);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  if (prefillDateIso) {
    if (DATE_ONLY_ROUTE_PATTERN.test(prefillDateIso)) {
      const [year, month, day] = prefillDateIso.split('-').map(Number);
      return new Date(year, month - 1, day, 23, 59, 0, 0);
    }

    const parsed = new Date(prefillDateIso);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
};

export default function CreateTaskScreen({ navigation, route }: any) {
  const { colors } = useTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [status, setStatus] = useState<Status>('TODO');
  const [dueDate, setDueDate] = useState('');
  const [hasSubtasks, setHasSubtasks] = useState(false);
  const [subtaskInputs, setSubtaskInputs] = useState<SubtaskInput[]>([
    { id: `subtask-${Date.now()}`, title: '', description: '' },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeNav, setActiveNav] = useState('Create');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time'>('date');
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showAiAssistModal, setShowAiAssistModal] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [formNoticeMessage, setFormNoticeMessage] = useState<string | null>(null);
  const prefillKeyRef = useRef<string | null>(null);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const modalTranslateY = useRef(new Animated.Value(40)).current;
  const aiModalOpacity = useRef(new Animated.Value(0)).current;
  const aiModalTranslateY = useRef(new Animated.Value(20)).current;
  const noticeOpacity = useRef(new Animated.Value(0)).current;
  const noticeTranslateY = useRef(new Animated.Value(-8)).current;

  const clearNoticeTimer = React.useCallback(() => {
    if (noticeTimeoutRef.current) {
      clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = null;
    }
  }, []);

  const closeAiAssistModal = React.useCallback(() => {
    Animated.parallel([
      Animated.timing(aiModalOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(aiModalTranslateY, { toValue: 20, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      setShowAiAssistModal(false);
    });
  }, [aiModalOpacity, aiModalTranslateY]);

  const showFormNotice = React.useCallback(
    (message: string, duration = 1300, onComplete?: () => void) => {
      clearNoticeTimer();
      setFormNoticeMessage(message);
      noticeOpacity.setValue(0);
      noticeTranslateY.setValue(-8);

      Animated.parallel([
        Animated.timing(noticeOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(noticeTranslateY, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();

      noticeTimeoutRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(noticeOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
          Animated.timing(noticeTranslateY, { toValue: -8, duration: 160, useNativeDriver: true }),
        ]).start(() => {
          setFormNoticeMessage(null);
          onComplete?.();
        });
        noticeTimeoutRef.current = null;
      }, duration);
    },
    [clearNoticeTimer, noticeOpacity, noticeTranslateY]
  );

  const resetForm = React.useCallback(() => {
    setTitle('');
    setDescription('');
    setPriority('MEDIUM');
    setStatus('TODO');
    setDueDate('');
    setHasSubtasks(false);
    setSubtaskInputs([{ id: `subtask-${Date.now()}`, title: '', description: '' }]);

    setShowDatePicker(false);
    setSelectedDate(new Date());
    setDatePickerMode('date');
    setShowStatusPicker(false);

    setShowAiAssistModal(false);
    setAiInput('');
    setAiError(null);
    setFormNoticeMessage(null);

    setAiLoading(false);
    setIsSubmitting(false);
    prefillKeyRef.current = null;

    clearNoticeTimer();

    modalOpacity.setValue(0);
    modalTranslateY.setValue(40);
    aiModalOpacity.setValue(0);
    aiModalTranslateY.setValue(20);
    noticeOpacity.setValue(0);
    noticeTranslateY.setValue(-8);
  }, [
    aiModalOpacity,
    aiModalTranslateY,
    clearNoticeTimer,
    modalOpacity,
    modalTranslateY,
    noticeOpacity,
    noticeTranslateY,
  ]);

  useEffect(() => {
    return () => {
      clearNoticeTimer();
    };
  }, [clearNoticeTimer]);

  useEffect(() => {
    if (!showAiAssistModal) return;
    aiModalOpacity.setValue(0);
    aiModalTranslateY.setValue(20);
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(aiModalOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(aiModalTranslateY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    });
  }, [showAiAssistModal, aiModalOpacity, aiModalTranslateY]);

  useFocusEffect(
    React.useCallback(() => {
      // Apply the user's stored default priority when entering the screen
      AsyncStorage.getItem(DEFAULT_PRIORITY_KEY)
        .then((stored) => {
          if (stored && ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(stored)) {
            setPriority(stored as Priority);
          }
        })
        .catch(() => {});

      return () => {
        resetForm();
      };
    }, [resetForm])
  );

  const mapPriority = (parsedPriority: ParsedTaskResponse['priority'], sourceText: string): Priority => {
    if (!parsedPriority) return 'MEDIUM';
    if (parsedPriority === 'HIGH' && /\burgent\b/i.test(sourceText)) {
      return 'URGENT';
    }
    return parsedPriority;
  };

  const applyParsedSubtasks = (parsedSubtasks: string[] | null) => {
    if (!parsedSubtasks || parsedSubtasks.length === 0) {
      return;
    }

    setHasSubtasks(true);
    setSubtaskInputs(
      parsedSubtasks
        .filter((subtask) => typeof subtask === 'string' && subtask.trim().length > 0)
        .map((subtask, index) => ({
          id: `ai-subtask-${Date.now()}-${index}`,
          title: subtask.trim(),
          description: '',
        }))
    );
  };

  const handleAiAssistParse = async () => {
    if (!aiInput.trim()) {
      setAiError('Please enter a task description first.');
      return;
    }

    setAiLoading(true);
    setAiError(null);

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const parsed = await parseTask(aiInput.trim(), timezone);

      setTitle(parsed.title ?? '');
      setDescription(parsed.description ?? '');
      setDueDate(parsed.dueDate ?? '');
      setPriority(mapPriority(parsed.priority, aiInput));
      applyParsedSubtasks(parsed.subtasks);

      closeAiAssistModal();
      setAiInput('');
      setAiError(null);
      showFormNotice('AI suggestions applied. Review and create when ready.', 1500);
    } catch (error: any) {
      if (error instanceof ApiError) {
        if (error.status === 422 && error.issues?.length) {
          setAiError(`Could not parse task clearly:\n• ${error.issues.join('\n• ')}`);
        } else {
          setAiError(error.message);
        }
      } else {
        setAiError('Failed to parse task. Please try again.');
      }
    } finally {
      setAiLoading(false);
    }
  };

  const onDateChange = (event: any, date?: Date) => {
    if (Platform.OS !== 'ios') return;
    if (event.type !== 'set' || !date) return;

    const updatedDate = new Date(selectedDate);
    if (datePickerMode === 'date') {
      updatedDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    } else {
      updatedDate.setHours(date.getHours(), date.getMinutes(), 0, 0);
    }

    setSelectedDate(updatedDate);
  };

  const withDefaultTime = (date: Date): Date => {
    const normalized = new Date(date);
    normalized.setHours(23, 59, 0, 0);
    return normalized;
  };

  const commitDueDate = (date: Date) => {
    const normalized = new Date(date);
    normalized.setSeconds(0, 0);
    setSelectedDate(normalized);
    setDueDate(normalized.toISOString());
  };

  useEffect(() => {
    const prefillDueAtIso = route?.params?.prefillDueAtIso;
    const prefillDateIso = route?.params?.prefillDateIso;

    if (!prefillDueAtIso && !prefillDateIso) return;

    const key = `${prefillDueAtIso ?? ''}|${prefillDateIso ?? ''}`;
    if (prefillKeyRef.current === key) return;

    const resolved = resolvePrefillDate(prefillDueAtIso, prefillDateIso);
    if (!resolved) return;

    commitDueDate(resolved);
    prefillKeyRef.current = key;

    if (typeof navigation?.setParams === 'function') {
      navigation.setParams({ prefillDueAtIso: undefined, prefillDateIso: undefined });
    }
  }, [route?.params?.prefillDueAtIso, route?.params?.prefillDateIso, navigation]);

  const openAndroidTimePicker = (baseDate: Date) => {
    DateTimePickerAndroid.open({
      value: baseDate,
      mode: 'time',
      is24Hour: false,
      onChange: (event, timeValue) => {
        if (event.type === 'set' && timeValue) {
          const withTime = new Date(baseDate);
          withTime.setHours(timeValue.getHours(), timeValue.getMinutes(), 0, 0);
          commitDueDate(withTime);
          return;
        }

        commitDueDate(baseDate);
      },
    });
  };

  const openDatePicker = () => {
    const parsedDueDate = dueDate ? new Date(dueDate) : new Date();
    const baseDate = Number.isNaN(parsedDueDate.getTime()) ? new Date() : parsedDueDate;
    const defaultedDate = withDefaultTime(baseDate);

    setSelectedDate(defaultedDate);

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: defaultedDate,
        mode: 'date',
        display: 'calendar',
        onChange: (event, selectedDateValue) => {
          if (event.type !== 'set' || !selectedDateValue) return;
          const selectedWithDefaultTime = withDefaultTime(selectedDateValue);
          setSelectedDate(selectedWithDefaultTime);
          openAndroidTimePicker(selectedWithDefaultTime);
        },
        minimumDate: new Date(),
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

  const handleClearDate = () => {
    setDueDate('');
    setSelectedDate(new Date());
    setDatePickerMode('date');
  };

  const handleToday = () => {
    const today = withDefaultTime(new Date());
    commitDueDate(today);
  };

  const handleTomorrow = () => {
    const tomorrow = withDefaultTime(new Date());
    tomorrow.setDate(tomorrow.getDate() + 1);
    commitDueDate(tomorrow);
  };

  // Add new subtask input with unique ID
  const addSubtaskInput = () => {
    const newId = `subtask-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setSubtaskInputs([...subtaskInputs, { id: newId, title: '', description: '' }]);
  };

  // Update subtask title
  const updateSubtaskTitle = (id: string, newTitle: string) => {
    setSubtaskInputs((prevSubtasks) =>
      prevSubtasks.map((subtask) =>
        subtask.id === id ? { ...subtask, title: newTitle } : subtask
      )
    );
  };

  // Update subtask description
  const updateSubtaskDescription = (id: string, newDescription: string) => {
    setSubtaskInputs((prevSubtasks) =>
      prevSubtasks.map((subtask) =>
        subtask.id === id ? { ...subtask, description: newDescription } : subtask
      )
    );
  };

  // Remove subtask input
  const removeSubtaskInput = (id: string) => {
    if (subtaskInputs.length > 1) {
      setSubtaskInputs((prevSubtasks) => 
        prevSubtasks.filter((subtask) => subtask.id !== id)
      );
    }
  };

  // Toggle subtasks feature
  const toggleSubtasks = (value: boolean) => {
    setHasSubtasks(value);
    if (!value) {
      // Reset subtasks when disabled
      setSubtaskInputs([{ id: `subtask-${Date.now()}`, title: '', description: '' }]);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a task title.');
      return;
    }

    // Validate subtasks if enabled
    if (hasSubtasks) {
      const filledSubtasks = subtaskInputs.filter((st) => st.title.trim());
      if (filledSubtasks.length === 0) {
        Alert.alert(
          'Empty Subtasks',
          'Please add at least one subtask or disable subtasks.'
        );
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const token = await getAuthToken();
      
      if (!token) {
        Alert.alert('Error', 'No authentication token found. Please log in again.');
        navigation.replace('Login');
        return;
      }

      const normalizedDueDate = dueDate ? normalizeDate(dueDate) : undefined;

      // Prepare task data for backend
      const taskData = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        status,
        dueAt: normalizedDueDate,
      };

      console.log('Creating task with data:', taskData);
      const data = await createTask(taskData);
      console.log('Task creation response:', data);

      const createdTask = data.task;

      // Create subtasks if enabled
      if (hasSubtasks) {
        const filledSubtasks = subtaskInputs.filter((st) => st.title.trim());
        
        console.log('Creating subtasks:', filledSubtasks);
        
        for (const subtask of filledSubtasks) {
          try {
            const subtaskData = {
              title: subtask.title.trim(),
              description: subtask.description?.trim() || undefined,
              status: 'TODO',
            };

            console.log('Sending subtask data:', subtaskData);

            const subtaskResponse = await fetch(
              `${API_BASE_URL}/api/tasks/${createdTask.id}/subtasks`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(subtaskData),
              }
            );

            if (!subtaskResponse.ok) {
              const errorData = await subtaskResponse.json();
              console.error('Failed to create subtask:', subtask.title, errorData);
            } else {
              const subtaskResponseData = await subtaskResponse.json();
              console.log('Created subtask:', subtaskResponseData);
            }
          } catch (error) {
            console.error('Error creating subtask:', error);
          }
        }
      }

      const successMessage = hasSubtasks
        ? 'Task and subtasks created. Taking you to Home...'
        : 'Task created. Taking you to Home...';

      // Clear form
      resetForm();

      showFormNotice(successMessage, 850, () => {
        navigation.navigate('Home', { refresh: true });
      });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          Alert.alert('Session Expired', 'Please log in again.');
          navigation.replace('Login');
        } else {
          Alert.alert('Error', error.message || 'Failed to create task');
        }
        return;
      }

      console.error('Error creating task:', error);
      Alert.alert('Error', 'Failed to create task. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.headerContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Create Task</Text>
        <Text style={[styles.headerSubtitle, { color: colors.mutedText }]}>
          Capture what matters and set it up clearly.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {formNoticeMessage ? (
          <Animated.View
            style={[
              styles.formNotice,
              { backgroundColor: colors.primary + '12', borderColor: colors.primary + '34' },
              { opacity: noticeOpacity, transform: [{ translateY: noticeTranslateY }] },
            ]}
          >
            <MaterialIcons name="check-circle" size={16} color={colors.primary} />
            <Text style={[styles.formNoticeText, { color: colors.text }]}>{formNoticeMessage}</Text>
          </Animated.View>
        ) : null}

        <TouchableOpacity
          style={[
            styles.aiAssistButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.primary + '2D',
              shadowColor: colors.primary,
            },
          ]}
          onPress={() => {
            setShowAiAssistModal(true);
            setAiError(null);
          }}
          activeOpacity={0.75}
        >
          <View style={[styles.aiAssistIconWrap, { backgroundColor: colors.primary + '1A' }]}>
            <MaterialIcons name="auto-awesome" size={18} color={colors.primary} />
          </View>
          <View style={styles.aiAssistBody}>
            <Text style={[styles.aiAssistText, { color: colors.text }]}>AI Assist</Text>
            <Text style={[styles.aiAssistHint, { color: colors.mutedText }]}>Describe naturally and auto-fill the form</Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={colors.mutedText} />
        </TouchableOpacity>

        {/* Title Field */}
        <View style={styles.field}>
          <AppInput
            label="Task Title"
            placeholder="e.g., Complete Math Homework"
            value={title}
            onChangeText={setTitle}
            editable={!isSubmitting}
            containerStyle={styles.appInputContainer}
          />
        </View>

        {/* Description Field */}
        <View style={styles.field}>
          <AppInput
            label="Description"
            helperText="Optional"
            placeholder="Add more details about this task"
            value={description}
            onChangeText={setDescription}
            multiline
            editable={!isSubmitting}
            containerStyle={styles.appInputContainer}
            inputStyle={styles.textAreaInput}
          />
        </View>

        {/* Due Date Field */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Due Date</Text>
          <TouchableOpacity
            style={[styles.dateFieldButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={openDatePicker}
            disabled={isSubmitting}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={dueDate ? `Due date: ${formatDateForDisplayLong(new Date(dueDate))}` : 'Select due date'}
          >
            <View style={styles.dateFieldBody}>
              <View style={[styles.dateFieldIconWrap, { backgroundColor: colors.primary + '14' }]}>
                <MaterialIcons name="calendar-today" size={16} color={colors.primary} />
              </View>
              <View style={styles.dateFieldTextWrap}>
                <Text
                  style={[
                    styles.dateFieldText,
                    { color: dueDate ? colors.text : colors.mutedText },
                  ]}
                >
                  {dueDate ? formatDateForDisplayLong(new Date(dueDate)) : 'No due date selected'}
                </Text>
                <Text style={[styles.dateFieldSubtext, { color: colors.mutedText }]}> 
                  {dueDate
                    ? new Date(dueDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                    : 'Tap to choose date and time'}
                </Text>
              </View>
            </View>
            <MaterialIcons name="keyboard-arrow-right" size={22} color={colors.mutedText} />
          </TouchableOpacity>
          <Text style={[styles.helperText, { color: colors.mutedText }]}>Optional - tap to select</Text>
          <View style={[styles.dateQuickActions, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <TouchableOpacity
              onPress={handleToday}
              style={[styles.dateQuickActionButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.dateQuickActionText, { color: colors.text }]}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleTomorrow}
              style={[styles.dateQuickActionButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.dateQuickActionText, { color: colors.text }]}>Tomorrow</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleClearDate}
              style={[styles.dateQuickActionButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.dateQuickActionText, { color: colors.danger }]}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Date Picker */}
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
                  <TouchableOpacity onPress={handleClearDate}>
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
                      onPress={() => {
                        commitDueDate(selectedDate);
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

        <Modal
          transparent
          animationType="none"
          visible={showAiAssistModal}
          onRequestClose={closeAiAssistModal}
        >
          <View style={styles.modalRoot}>
            <Pressable
              onPress={closeAiAssistModal}
              style={styles.modalBackdropPressable}
            >
              <Animated.View style={[styles.modalBackdrop, { opacity: aiModalOpacity }]} />
            </Pressable>

            <Animated.View
              style={[
                styles.aiAssistModalCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                { opacity: aiModalOpacity, transform: [{ translateY: aiModalTranslateY }] },
              ]}
            >
              <View style={styles.aiAssistModalHeader}>
                <View style={[styles.aiAssistModalIcon, { backgroundColor: colors.primary + '16' }]}>
                  <MaterialIcons name="auto-awesome" size={18} color={colors.primary} />
                </View>
                <View style={styles.aiAssistModalTitleWrap}>
                  <Text style={[styles.aiAssistModalTitle, { color: colors.text }]}>AI Assist</Text>
                  <Text style={[styles.aiAssistModalSubtitle, { color: colors.mutedText }]}>Turn a quick thought into a structured task</Text>
                </View>
              </View>
              <TextInput
                style={[
                  styles.aiAssistInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="Describe your task naturally..."
                placeholderTextColor={colors.mutedText}
                multiline
                value={aiInput}
                onChangeText={setAiInput}
                editable={!aiLoading}
              />

              {aiError ? <Text style={[styles.aiAssistError, { color: colors.danger }]}>{aiError}</Text> : null}

              <View style={styles.aiAssistActions}>
                <TouchableOpacity
                  style={[styles.aiAssistSecondaryButton, { borderColor: colors.border }]}
                  onPress={() => {
                    closeAiAssistModal();
                    setAiError(null);
                  }}
                  disabled={aiLoading}
                >
                  <Text style={[styles.aiAssistSecondaryText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.aiAssistPrimaryButton, { backgroundColor: colors.primary }]}
                  onPress={handleAiAssistParse}
                  disabled={aiLoading}
                >
                  {aiLoading ? (
                    <ActivityIndicator size="small" color={colors.surface} />
                  ) : (
                    <Text style={[styles.aiAssistPrimaryText, { color: colors.surface }]}>Parse</Text>
                  )}
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>

        {/* Priority Field */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Priority</Text>
          <View style={styles.chipRow}>
            {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as Priority[]).map((level) => {
              const isSelected = priority === level;
              return (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.chip,
                    isSelected
                      ? { backgroundColor: colors.primary, borderColor: colors.primary }
                      : { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                  onPress={() => setPriority(level)}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: isSelected ? colors.surface : colors.text },
                    ]}
                  >
                    {level.charAt(0) + level.slice(1).toLowerCase()}
                  </Text>
                  {isSelected ? <MaterialIcons name="check" size={14} color={colors.surface} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Status Field */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Status</Text>
          <TouchableOpacity 
            style={[styles.dropdownButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setShowStatusPicker(!showStatusPicker)}
            disabled={isSubmitting}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Status: ${STATUS_META[status].label}`}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialIcons name={STATUS_META[status].icon} size={20} color={colors.mutedText} />
              <Text style={[styles.dropdownText, { color: colors.text }]}>
                {STATUS_META[status].label}
              </Text>
            </View>
            <MaterialIcons 
              name={showStatusPicker ? "arrow-drop-up" : "arrow-drop-down"} 
              size={24} 
              color={colors.mutedText}
            />
          </TouchableOpacity>
          
          {/* Status Dropdown Options */}
          {showStatusPicker && (
            <View style={[styles.dropdownMenu, styles.statusMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              {(Object.keys(STATUS_META) as Status[]).map((statusOption, index, options) => {
                const isSelected = status === statusOption;
                const isLast = index === options.length - 1;

                return (
                  <TouchableOpacity
                    key={statusOption}
                    style={[
                      styles.dropdownOption,
                      isSelected && [styles.dropdownOptionActive, { backgroundColor: colors.primary + '15' }],
                      !isLast && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
                    ]}
                    onPress={() => {
                      setStatus(statusOption);
                      setShowStatusPicker(false);
                    }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={STATUS_META[statusOption].label}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <MaterialIcons
                        name={STATUS_META[statusOption].icon}
                        size={20}
                        color={isSelected ? colors.primary : colors.mutedText}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.dropdownOptionText,
                            isSelected && [styles.dropdownOptionTextActive, { color: colors.primary }],
                            { color: isSelected ? colors.primary : colors.text },
                          ]}
                        >
                          {STATUS_META[statusOption].label}
                        </Text>
                        {STATUS_META[statusOption].helper ? (
                          <Text style={[styles.dropdownHelperText, { color: colors.mutedText }]}> 
                            {STATUS_META[statusOption].helper}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View
                      style={[
                        styles.dropdownCheckWrap,
                        { opacity: isSelected ? 1 : 0 },
                      ]}
                    >
                      <MaterialIcons name="check" size={18} color={colors.primary} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Subtasks Toggle */}
        <View style={[styles.fieldRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.fieldRowLeft}>
            <Text style={[styles.label, { color: colors.text }]}>Enable Subtasks</Text>
            <Text style={[styles.helperText, { color: colors.mutedText }]}>
              Break down this task into smaller steps.
            </Text>
          </View>
          <Switch 
            value={hasSubtasks} 
            onValueChange={toggleSubtasks}
            disabled={isSubmitting}
            trackColor={{ false: colors.border, true: colors.primary + '50' }}
            thumbColor={hasSubtasks ? colors.primary : colors.card}
            ios_backgroundColor={colors.border}
          />
        </View>

        {/* Subtasks Section */}
        {hasSubtasks && (
          <View style={[styles.subtasksSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.subtasksHeaderRow}>
              <View>
                <Text style={[styles.subtasksSectionTitle, { color: colors.text }]}>Subtasks</Text>
                <Text style={[styles.subtasksSectionHint, { color: colors.mutedText }]}>Break work into clear, actionable steps</Text>
              </View>
              <View style={[styles.subtasksCountPill, { backgroundColor: colors.card }]}> 
                <Text style={[styles.subtasksCount, { color: colors.mutedText }]}>{subtaskInputs.length}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.addSubtaskButton, { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
              onPress={addSubtaskInput}
              disabled={isSubmitting}
              activeOpacity={0.7}
            >
              <MaterialIcons name="add-circle-outline" size={20} color={colors.primary} />
              <Text style={[styles.addSubtaskText, { color: colors.primary }]}>Add Another Subtask</Text>
            </TouchableOpacity>
            
            {subtaskInputs.map((subtask, index) => (
              <View key={subtask.id} style={[styles.subtaskCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                {/* Subtask Header */}
                <View style={styles.subtaskHeader}>
                  <Text style={[styles.subtaskLabel, { color: colors.mutedText }]}>Subtask {index + 1}</Text>
                  {subtaskInputs.length > 1 && (
                    <TouchableOpacity
                      style={[styles.removeSubtaskButton, { backgroundColor: colors.border }]}
                      onPress={() => removeSubtaskInput(subtask.id)}
                      disabled={isSubmitting}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="close" size={18} color={colors.mutedText} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Subtask Title Input */}
                <TextInput
                  style={[styles.subtaskInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="Subtask title"
                  placeholderTextColor={colors.mutedText}
                  value={subtask.title}
                  onChangeText={(text) => updateSubtaskTitle(subtask.id, text)}
                  editable={!isSubmitting}
                />

                {/* Subtask Description Input (Optional) */}
                <TextInput
                  style={[styles.subtaskInput, styles.subtaskDescriptionInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="Description (optional)"
                  placeholderTextColor={colors.mutedText}
                  value={subtask.description}
                  onChangeText={(text) => updateSubtaskDescription(subtask.id, text)}
                  editable={!isSubmitting}
                  multiline
                  numberOfLines={2}
                />
              </View>
            ))}

            {/* Add Another Subtask Button */}
            
          </View>
        )}

        {/* Create Task Button */}
        <View style={[styles.ctaContainer, { borderTopColor: colors.border }]}> 
          <AppButton
            title="Create Task"
            onPress={handleSave}
            disabled={isSubmitting}
            loading={isSubmitting}
            leftIcon={<MaterialIcons name="add-task" size={20} color="#FFFFFF" />}
            style={[styles.createButton, { backgroundColor: colors.primary }, isSubmitting && styles.createButtonDisabled]}
          />
        </View>
      </ScrollView>

      {/* Bottom Navigation - Matches HomeScreen style */}
      <View style={[styles.bottomNav, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            setActiveNav('Home');
            navigation.navigate('Home');
          }}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name="home"
            size={26}
            color={activeNav === 'Home' ? colors.primary : colors.mutedText}
          />
          <Text
            style={[
              styles.navText,
              activeNav === 'Home' && [styles.navTextActive, { color: colors.primary }],
              { color: activeNav === 'Home' ? colors.primary : colors.mutedText },
            ]}
          >
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveNav('Create')}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name="add-circle"
            size={26}
            color={activeNav === 'Create' ? colors.primary : colors.mutedText}
          />
          <Text
            style={[
              styles.navText,
              activeNav === 'Create' && [styles.navTextActive, { color: colors.primary }],
              { color: activeNav === 'Create' ? colors.primary : colors.mutedText },
            ]}
          >
            Create
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            setActiveNav('Calendar');
            navigation.navigate('Calendar');
          }}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name="calendar-today"
            size={26}
            color={activeNav === 'Calendar' ? colors.primary : colors.mutedText}
          />
          <Text
            style={[
              styles.navText,
              activeNav === 'Calendar' && [styles.navTextActive, { color: colors.primary }],
              { color: activeNav === 'Calendar' ? colors.primary : colors.mutedText },
            ]}
          >
            Calendar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            setActiveNav('Account');
            navigation.navigate('Account');
          }}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name="account-circle"
            size={26}
            color={activeNav === 'Account' ? colors.primary : colors.mutedText}
          />
          <Text
            style={[
              styles.navText,
              activeNav === 'Account' && [styles.navTextActive, { color: colors.primary }],
              { color: activeNav === 'Account' ? colors.primary : colors.mutedText },
            ]}
          >
            Account
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Container
  container: { 
    flex: 1,
  },

  // Header - Card-like with soft background, subtle shadow
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  headerTitle: { 
    fontSize: 23,
    fontWeight: '700',
    marginBottom: 3,
  },
  headerSubtitle: { 
    fontSize: 13,
    lineHeight: 18,
  },

  // Scroll Content
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 150,
  },

  formNotice: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  formNoticeText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },

  // AI Assist
  aiAssistButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  aiAssistIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiAssistBody: {
    flex: 1,
  },
  aiAssistText: {
    fontSize: 14,
    fontWeight: '700',
  },
  aiAssistHint: {
    fontSize: 12,
    marginTop: 1,
  },
  aiAssistModalCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
  },
  aiAssistModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiAssistModalIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  aiAssistModalTitleWrap: {
    flex: 1,
  },
  aiAssistModalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  aiAssistModalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  aiAssistInput: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 116,
    textAlignVertical: 'top',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
  },
  aiAssistError: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
  },
  aiAssistActions: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  aiAssistSecondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  aiAssistSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  aiAssistPrimaryButton: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  aiAssistPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Form Fields
  field: { 
    marginBottom: 18,
  },
  appInputContainer: {
    marginBottom: 0,
  },
  fieldRow: {
    marginBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  fieldRowLeft: {
    flex: 1,
    marginRight: 16,
  },
  label: { 
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 7,
  },
  helperText: { 
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },

  // Inputs
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  textArea: { 
    minHeight: 100, 
    textAlignVertical: 'top',
  },
  textAreaInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },

  // Due Date Field
  dateFieldButton: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateFieldBody: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  dateFieldIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  dateFieldTextWrap: {
    flex: 1,
  },
  dateFieldText: {
    fontSize: 15,
    fontWeight: '600',
  },
  dateFieldSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  dateQuickActions: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 8,
  },
  dateQuickActionButton: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  dateQuickActionText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // iOS Date Picker Modal
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 18,
    paddingTop: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
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

  // Dropdown
  dropdownButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: 15,
    fontWeight: '500',
  },
  dropdownMenu: {
    marginTop: 9,
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusMenu: {
    borderRadius: 16,
  },
  dropdownOption: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 36,
  },
  dropdownOptionActive: {
  },
  dropdownOptionText: {
    fontSize: 15,
  },
  dropdownOptionTextActive: {
    fontWeight: '600',
  },
  dropdownHelperText: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  dropdownCheckWrap: {
    marginLeft: 6,
    marginRight: 6,
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Priority chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Subtasks Section
  subtasksSection: {
    marginBottom: 18,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  subtasksHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  subtasksSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtasksSectionHint: {
    fontSize: 12,
    marginTop: 2,
  },
  subtasksCountPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  subtasksCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  subtaskCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  subtaskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  subtaskLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  subtaskInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  subtaskDescriptionInput: {
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 0,
  },
  removeSubtaskButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addSubtaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginBottom: 12,
  },
  addSubtaskText: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Create Button
  ctaContainer: {
    borderTopWidth: 1,
    paddingTop: 14,
    paddingBottom: 10,
    marginTop: 4,
  },
  createButton: {
    marginTop: 4,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
    borderRadius: 12,
  },
  createButtonDisabled: {
    shadowOpacity: 0.1,
  },
  createButtonText: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    fontWeight: '700',
    marginLeft: 8,
  },

  // Bottom Navigation
  bottomNav: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    right: 10,
    height: 72,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
    borderTopWidth: 1,
    borderRadius: 18,
  },
  navItem: { 
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  navText: { 
    fontSize: 11, 
    fontWeight: '600',
    marginTop: 4,
  },
  navTextActive: { 
  },
});