import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useTheme, useThemePreference } from '../theme';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ApiError,
  createSubtaskForTask,
  createTask,
  getUserFriendlyErrorMessage,
  parseTask,
  transcribeAudio,
  type ParsedTaskResponse,
} from '../config/api';
import { logger } from '../utils/logger';
import { DEFAULT_PRIORITY_KEY } from './GeneralSettingsScreen';
import AppInput from '../components/AppInput';
import AppButton from '../components/AppButton';
import { isAuthExitInProgress } from '../auth/authExitState';
import { handleUnauthorizedIfNeeded } from '../auth/unauthorizedHandler';

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

const toLocalDayKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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

const PRIORITY_META: Record<string, { icon: keyof typeof MaterialIcons.glyphMap; color: string }> = {
  LOW: { icon: 'arrow-downward', color: '#10B981' },
  MEDIUM: { icon: 'remove', color: '#F59E0B' },
  HIGH: { icon: 'arrow-upward', color: '#EF4444' },
  URGENT: { icon: 'priority-high', color: '#DC2626' },
};

export default function CreateTaskScreen({ navigation, route, onSessionExpired }: any) {
  const { colors } = useTheme();
  const { currentTheme } = useThemePreference();
  const isDark = currentTheme === 'dark';

  const backgroundGradient = useMemo<readonly [string, string]>(
    () => (isDark ? ['#07101D', '#152440'] : ['#FFFDF8', '#EEF4FF']),
    [isDark]
  );
  const surfaceElevated = isDark ? 'rgba(17, 28, 47, 0.92)' : 'rgba(255, 255, 255, 0.96)';
  const surfaceMuted = isDark ? 'rgba(14, 22, 38, 0.88)' : 'rgba(248, 250, 255, 0.9)';
  const cardBorder = isDark ? 'rgba(90, 113, 152, 0.28)' : 'rgba(0, 74, 173, 0.10)';
  const fieldBorder = isDark ? 'rgba(90, 113, 152, 0.24)' : 'rgba(0, 74, 173, 0.12)';
  const primaryTint = `${colors.primary}16`;
  const primaryTintStrong = `${colors.primary}28`;

  const ctaScale = useRef(new Animated.Value(1)).current;
  const animateCta = (toValue: number) =>
    Animated.spring(ctaScale, { toValue, useNativeDriver: true, tension: 240, friction: 18 }).start();

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
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [formNoticeMessage, setFormNoticeMessage] = useState<string | null>(null);
  const prefillKeyRef = useRef<string | null>(null);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const modalTranslateY = useRef(new Animated.Value(40)).current;
  const aiModalOpacity = useRef(new Animated.Value(0)).current;
  const aiModalTranslateY = useRef(new Animated.Value(20)).current;
  const recordingRef = useRef<Audio.Recording | null>(null);
  const noticeOpacity = useRef(new Animated.Value(0)).current;
  const noticeTranslateY = useRef(new Animated.Value(-8)).current;

  const parsedDueDate = dueDate ? new Date(dueDate) : null;
  const hasValidDueDate = Boolean(parsedDueDate && !Number.isNaN(parsedDueDate.getTime()));
  const todayKey = toLocalDayKey(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowKey = toLocalDayKey(tomorrowDate);
  const dueDateKey = hasValidDueDate && parsedDueDate ? toLocalDayKey(parsedDueDate) : null;
  const isTodayQuickSelected = dueDateKey === todayKey;
  const isTomorrowQuickSelected = dueDateKey === tomorrowKey;

  const clearNoticeTimer = React.useCallback(() => {
    if (noticeTimeoutRef.current) {
      clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = null;
    }
  }, []);

  const triggerSelectionHaptic = () => void Haptics.selectionAsync().catch(() => undefined);
  const triggerImpactHaptic = () =>
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);

  const closeAiAssistModal = React.useCallback(() => {
    const activeRecording = recordingRef.current;
    recordingRef.current = null;

    if (activeRecording) {
      void activeRecording.stopAndUnloadAsync().catch(() => undefined);
      void Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => undefined);
    }

    setIsRecording(false);
    setIsTranscribing(false);

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
    setIsRecording(false);
    setIsTranscribing(false);
    setIsSubmitting(false);
    prefillKeyRef.current = null;

    const activeRecording = recordingRef.current;
    recordingRef.current = null;
    if (activeRecording) {
      void activeRecording.stopAndUnloadAsync().catch(() => undefined);
      void Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => undefined);
    }

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

      const activeRecording = recordingRef.current;
      recordingRef.current = null;
      if (activeRecording) {
        void activeRecording.stopAndUnloadAsync().catch(() => undefined);
      }
      void Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => undefined);
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
    if (isRecording || isTranscribing) {
      setAiError('Finish voice transcription before parsing.');
      return;
    }

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
      if (await handleUnauthorizedIfNeeded({ error, source: 'CreateTaskScreen.handleAiAssistParse', onSessionExpired })) {
        closeAiAssistModal();
        return;
      }

      if (error instanceof ApiError) {
        if (error.status === 422 && error.issues?.length) {
          setAiError(`Could not parse task clearly:\n• ${error.issues.join('\n• ')}`);
        } else {
          setAiError(getUserFriendlyErrorMessage(error, 'Failed to parse task. Please try again.'));
        }
      } else {
        setAiError(getUserFriendlyErrorMessage(error, 'Failed to parse task. Please try again.'));
      }
    } finally {
      setAiLoading(false);
    }
  };

  const requestMicrophonePermission = async (): Promise<boolean> => {
    const currentPermission = await Audio.getPermissionsAsync();
    const permission = currentPermission.status === 'granted'
      ? currentPermission
      : await Audio.requestPermissionsAsync();

    if (permission.status === 'granted') {
      return true;
    }

    setAiError(
      permission.canAskAgain
        ? 'Microphone permission is required to record your task.'
        : 'Microphone access is disabled. Enable it in Settings to use voice input.'
    );
    return false;
  };

  const startVoiceRecording = async () => {
    if (aiLoading || isTranscribing || isRecording) {
      return;
    }

    const allowed = await requestMicrophonePermission();
    if (!allowed) {
      return;
    }

    try {
      setAiError(null);
      triggerSelectionHaptic();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      recordingRef.current = recording;
      setIsRecording(true);
    } catch {
      recordingRef.current = null;
      setIsRecording(false);
      setAiError('Unable to start recording. Please try again.');
      void Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => undefined);
    }
  };

  const stopVoiceRecordingAndTranscribe = async () => {
    if (isTranscribing) {
      return;
    }

    const recording = recordingRef.current;
    if (!recording) {
      setIsRecording(false);
      return;
    }

    recordingRef.current = null;
    setIsRecording(false);
    setIsTranscribing(true);
    setAiError(null);

    try {
      await recording.stopAndUnloadAsync();
      void Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => undefined);

      const audioUri = recording.getURI();
      if (!audioUri) {
        setAiError('No audio was captured. Please try recording again.');
        return;
      }

      const { text } = await transcribeAudio(audioUri);
      const transcript = text.trim();

      if (!transcript) {
        setAiError('No speech was detected. Please try again.');
        return;
      }

      setAiInput(transcript);
      showFormNotice('Voice input ready. Review, edit, then tap Parse.', 1500);
    } catch (error: unknown) {
      if (await handleUnauthorizedIfNeeded({ error, source: 'CreateTaskScreen.stopVoiceRecordingAndTranscribe', onSessionExpired })) {
        return;
      }

      setAiError(getUserFriendlyErrorMessage(error, 'Transcription failed. Please try again.'));
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleVoiceInputPress = async () => {
    if (aiLoading || isTranscribing) {
      return;
    }

    if (isRecording) {
      await stopVoiceRecordingAndTranscribe();
      return;
    }

    await startVoiceRecording();
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

    triggerImpactHaptic();
    setIsSubmitting(true);

    try {
      const normalizedDueDate = dueDate ? normalizeDate(dueDate) : undefined;

      // Prepare task data for backend
      const taskData = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        status,
        dueAt: normalizedDueDate,
      };

      const data = await createTask(taskData);

      const createdTask = data.task;

      // Create subtasks if enabled
      if (hasSubtasks) {
        const filledSubtasks = subtaskInputs.filter((st) => st.title.trim());
        
        for (const subtask of filledSubtasks) {
          try {
            await createSubtaskForTask(createdTask.id, {
              title: subtask.title.trim(),
              description: subtask.description?.trim() || undefined,
              status: 'TODO',
            });
          } catch (error) {
            logger.warn('Subtask creation failed');
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
          if (!isAuthExitInProgress()) {
            await onSessionExpired?.();
          }
        } else {
          Alert.alert('Error', getUserFriendlyErrorMessage(error, 'Failed to create task.'));
        }
        return;
      }

      logger.warn('Task creation failed');
      Alert.alert('Error', getUserFriendlyErrorMessage(error, 'Failed to create task. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Premium background gradient */}
      <LinearGradient
        colors={backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={[styles.headerContainer, { borderBottomColor: cardBorder }]}>
        <LinearGradient
          colors={
            isDark
              ? ['rgba(17,28,47,0.97)', 'rgba(10,17,30,0.94)']
              : ['rgba(255,255,255,0.99)', 'rgba(241,247,255,0.97)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* ambient tint blobs */}
        <View style={[styles.headerGlowTop, { backgroundColor: isDark ? 'rgba(0,74,173,0.18)' : 'rgba(0,74,173,0.07)' }]} />
        <View style={[styles.headerGlowBottom, { backgroundColor: isDark ? 'rgba(125,211,252,0.09)' : 'rgba(147,197,253,0.10)' }]} />
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Create Task</Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedText }]}>
            Capture what matters and set it up clearly.
          </Text>
        </View>
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
              { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}34` },
              { opacity: noticeOpacity, transform: [{ translateY: noticeTranslateY }] },
            ]}
          >
            <MaterialIcons name="check-circle" size={16} color={colors.primary} />
            <Text style={[styles.formNoticeText, { color: colors.text }]}>{formNoticeMessage}</Text>
          </Animated.View>
        ) : null}

        {/* AI Assist — premium feature card */}
        <TouchableOpacity
          style={[
            styles.aiAssistButton,
            {
              backgroundColor: surfaceElevated,
              borderColor: `${colors.primary}2E`,
              shadowColor: colors.primary,
            },
          ]}
          onPress={() => {
            triggerSelectionHaptic();
            setShowAiAssistModal(true);
            setAiError(null);
          }}
          activeOpacity={0.78}
        >
          <LinearGradient
            colors={isDark ? ['rgba(0,74,173,0.26)', 'rgba(0,74,173,0.16)'] : ['rgba(0,74,173,0.14)', 'rgba(0,74,173,0.08)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.aiAssistIconWrap}
          >
            <MaterialIcons name="auto-awesome" size={19} color={colors.primary} />
          </LinearGradient>
          <View style={styles.aiAssistBody}>
            <Text style={[styles.aiAssistText, { color: colors.text }]}>AI Assist</Text>
            <Text style={[styles.aiAssistHint, { color: colors.mutedText }]}>Describe naturally, auto-fill the form</Text>
          </View>
          <View style={[styles.aiAssistArrow, { backgroundColor: primaryTint }]}>
            <MaterialIcons name="chevron-right" size={18} color={colors.primary} />
          </View>
        </TouchableOpacity>

        {/* Title Field */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.text }]}>Task Title</Text>
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
          <View style={styles.fieldLabelRow}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Description</Text>
            <Text style={[styles.fieldLabelHelper, { color: colors.mutedText }]}>Optional</Text>
          </View>
          <AppInput
            label="Description"
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
          <View style={styles.fieldLabelRow}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Due Date</Text>
            {!dueDate && <Text style={[styles.fieldLabelHelper, { color: colors.mutedText }]}>Optional</Text>}
          </View>
          <View style={[styles.dueDateCard, { backgroundColor: surfaceElevated, borderColor: fieldBorder }]}>
            <TouchableOpacity
              style={styles.dateFieldButton}
              onPress={openDatePicker}
              disabled={isSubmitting}
              activeOpacity={0.72}
              accessibilityRole="button"
              accessibilityLabel={dueDate ? `Due date: ${formatDateForDisplayLong(new Date(dueDate))}` : 'Select due date'}
            >
              <View style={[styles.dateFieldIconWrap, { backgroundColor: primaryTint }]}>
                <MaterialIcons name="calendar-today" size={17} color={colors.primary} />
              </View>
              <View style={styles.dateFieldTextWrap}>
                <Text
                  style={[
                    styles.dateFieldText,
                    { color: dueDate ? colors.text : colors.mutedText },
                  ]}
                >
                  {dueDate ? formatDateForDisplayLong(new Date(dueDate)) : 'No due date set'}
                </Text>
                <Text style={[styles.dateFieldSubtext, { color: colors.mutedText }]}>
                  {dueDate
                    ? new Date(dueDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                    : 'Tap to choose date and time'}
                </Text>
              </View>
              <MaterialIcons name="keyboard-arrow-right" size={22} color={isDark ? colors.mutedText : `${colors.primary}80`} />
            </TouchableOpacity>

            <View style={[styles.dateQuickDivider, { backgroundColor: fieldBorder }]} />

            <View style={styles.dateQuickActions}>
              <TouchableOpacity
                onPress={handleToday}
                style={[
                  styles.dateQuickChip,
                  {
                    borderColor: isTodayQuickSelected ? colors.primary : fieldBorder,
                    backgroundColor: isTodayQuickSelected ? `${colors.primary}16` : 'transparent',
                  },
                ]}
                activeOpacity={0.72}
              >
                <MaterialIcons name="today" size={13} color={isTodayQuickSelected ? colors.primary : colors.mutedText} />
                <Text style={[styles.dateQuickChipText, { color: isTodayQuickSelected ? colors.primary : colors.text }]}>
                  Today
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleTomorrow}
                style={[
                  styles.dateQuickChip,
                  {
                    borderColor: isTomorrowQuickSelected ? colors.primary : fieldBorder,
                    backgroundColor: isTomorrowQuickSelected ? `${colors.primary}16` : 'transparent',
                  },
                ]}
                activeOpacity={0.72}
              >
                <MaterialIcons name="event" size={13} color={isTomorrowQuickSelected ? colors.primary : colors.mutedText} />
                <Text style={[styles.dateQuickChipText, { color: isTomorrowQuickSelected ? colors.primary : colors.text }]}>
                  Tomorrow
                </Text>
              </TouchableOpacity>
              {dueDate ? (
                <TouchableOpacity
                  onPress={handleClearDate}
                  style={[styles.dateQuickChip, { borderColor: `${colors.danger}40`, backgroundColor: `${colors.danger}0D` }]}
                  activeOpacity={0.72}
                >
                  <MaterialIcons name="close" size={13} color={colors.danger} />
                  <Text style={[styles.dateQuickChipText, { color: colors.danger }]}>Clear</Text>
                </TouchableOpacity>
              ) : null}
            </View>
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
                editable={!aiLoading && !isTranscribing}
              />

              <View style={styles.aiAssistVoiceRow}>
                <TouchableOpacity
                  style={[
                    styles.aiAssistMicButton,
                    {
                      borderColor: isRecording ? colors.danger : colors.border,
                      backgroundColor: isRecording ? `${colors.danger}16` : `${colors.primary}10`,
                    },
                  ]}
                  onPress={handleVoiceInputPress}
                  disabled={aiLoading || isTranscribing}
                  activeOpacity={0.78}
                >
                  {isTranscribing ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <MaterialIcons
                      name={isRecording ? 'stop-circle' : 'keyboard-voice'}
                      size={18}
                      color={isRecording ? colors.danger : colors.primary}
                    />
                  )}
                  <Text
                    style={[
                      styles.aiAssistMicText,
                      { color: isRecording ? colors.danger : colors.primary },
                    ]}
                  >
                    {isTranscribing ? 'Transcribing…' : isRecording ? 'Stop Recording' : 'Use Voice'}
                  </Text>
                </TouchableOpacity>
                {isRecording ? (
                  <Text style={[styles.aiAssistRecordingHint, { color: colors.danger }]}>Recording in progress... tap to stop</Text>
                ) : null}
              </View>

              {aiError ? <Text style={[styles.aiAssistError, { color: colors.danger }]}>{aiError}</Text> : null}

              <View style={styles.aiAssistActions}>
                <TouchableOpacity
                  style={[styles.aiAssistSecondaryButton, { borderColor: colors.border }]}
                  onPress={() => {
                    closeAiAssistModal();
                    setAiError(null);
                  }}
                  disabled={aiLoading || isTranscribing}
                >
                  <Text style={[styles.aiAssistSecondaryText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.aiAssistPrimaryButton, { backgroundColor: colors.primary }]}
                  onPress={handleAiAssistParse}
                  disabled={aiLoading || isTranscribing || isRecording}
                >
                  {aiLoading || isTranscribing ? (
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
          <Text style={[styles.fieldLabel, { color: colors.text }]}>Priority</Text>
          <View style={styles.chipRow}>
            {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as Priority[]).map((level) => {
              const isSelected = priority === level;
              const meta = PRIORITY_META[level];
              return (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.priorityChip,
                    isSelected
                      ? {
                          backgroundColor: colors.primary,
                          borderColor: colors.primary,
                          shadowColor: colors.primary,
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.30,
                          shadowRadius: 8,
                          elevation: 4,
                        }
                      : {
                          backgroundColor: surfaceElevated,
                          borderColor: fieldBorder,
                        },
                  ]}
                  onPress={() => {
                    triggerSelectionHaptic();
                    setPriority(level);
                  }}
                  disabled={isSubmitting}
                  activeOpacity={0.78}
                >
                  <MaterialIcons
                    name={meta.icon}
                    size={13}
                    color={isSelected ? '#FFFFFF' : meta.color}
                  />
                  <Text
                    style={[
                      styles.priorityChipText,
                      { color: isSelected ? '#FFFFFF' : colors.text },
                    ]}
                  >
                    {level.charAt(0) + level.slice(1).toLowerCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Status Field */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.text }]}>Status</Text>
          <TouchableOpacity 
            style={[
              styles.statusButton,
              {
                backgroundColor: surfaceElevated,
                borderColor: fieldBorder,
                shadowColor: isDark ? '#000' : colors.primary,
              },
            ]}
            onPress={() => setShowStatusPicker(!showStatusPicker)}
            disabled={isSubmitting}
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel={`Status: ${STATUS_META[status].label}`}
          >
            <View style={[styles.statusIconWrap, { backgroundColor: primaryTint }]}>
              <MaterialIcons name={STATUS_META[status].icon} size={17} color={colors.primary} />
            </View>
            <Text style={[styles.statusText, { color: colors.text }]}>
              {STATUS_META[status].label}
            </Text>
            {STATUS_META[status].helper ? (
              <Text style={[styles.statusHelper, { color: colors.mutedText }]}>
                · {STATUS_META[status].helper}
              </Text>
            ) : null}
            <MaterialIcons 
              name={showStatusPicker ? 'expand-less' : 'expand-more'} 
              size={22} 
              color={isDark ? colors.mutedText : `${colors.primary}80`}
              style={styles.statusChevron}
            />
          </TouchableOpacity>
          
          {/* Status Dropdown Options */}
          {showStatusPicker && (
            <View style={[styles.dropdownMenu, { backgroundColor: surfaceElevated, borderColor: fieldBorder }]}> 
              {(Object.keys(STATUS_META) as Status[]).map((statusOption, index, options) => {
                const isSelected = status === statusOption;
                const isLast = index === options.length - 1;

                return (
                  <TouchableOpacity
                    key={statusOption}
                    style={[
                      styles.dropdownOption,
                      isSelected && { backgroundColor: `${colors.primary}12` },
                      !isLast && { borderBottomColor: fieldBorder, borderBottomWidth: StyleSheet.hairlineWidth },
                    ]}
                    onPress={() => {
                      triggerSelectionHaptic();
                      setStatus(statusOption);
                      setShowStatusPicker(false);
                    }}
                    activeOpacity={0.72}
                    accessibilityRole="button"
                    accessibilityLabel={STATUS_META[statusOption].label}
                  >
                    <View style={[styles.dropdownOptionIcon, { backgroundColor: isSelected ? primaryTintStrong : primaryTint }]}>
                      <MaterialIcons
                        name={STATUS_META[statusOption].icon}
                        size={16}
                        color={isSelected ? colors.primary : colors.mutedText}
                      />
                    </View>
                    <View style={styles.dropdownOptionContent}>
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          { color: isSelected ? colors.primary : colors.text },
                          isSelected && { fontWeight: '700' },
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
                    {isSelected ? (
                      <MaterialIcons name="check" size={17} color={colors.primary} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Subtasks Toggle */}
        <View style={[styles.subtasksToggleCard, { backgroundColor: surfaceElevated, borderColor: fieldBorder }]}>
          <View style={[styles.subtasksToggleIcon, { backgroundColor: primaryTint }]}>
            <MaterialIcons name="account-tree" size={17} color={colors.primary} />
          </View>
          <View style={styles.fieldRowLeft}>
            <Text style={[styles.fieldLabel, { color: colors.text, marginBottom: 2 }]}>Enable Subtasks</Text>
            <Text style={[styles.subtasksToggleHint, { color: colors.mutedText }]}>
              Break this task into smaller steps.
            </Text>
          </View>
          <Switch 
            value={hasSubtasks} 
            onValueChange={(v) => {
              triggerSelectionHaptic();
              toggleSubtasks(v);
            }}
            disabled={isSubmitting}
            trackColor={{ false: isDark ? colors.border : '#D1D5DB', true: `${colors.primary}60` }}
            thumbColor={hasSubtasks ? colors.primary : isDark ? '#6B7280' : '#FFFFFF'}
            ios_backgroundColor={isDark ? colors.border : '#D1D5DB'}
          />
        </View>

        {/* Subtasks Section */}
        {hasSubtasks && (
          <View style={[styles.subtasksSection, { backgroundColor: surfaceMuted, borderColor: fieldBorder }]}>
            <View style={styles.subtasksHeaderRow}>
              <View>
                <Text style={[styles.subtasksSectionTitle, { color: colors.text }]}>Subtasks</Text>
                <Text style={[styles.subtasksSectionHint, { color: colors.mutedText }]}>Break work into clear, actionable steps</Text>
              </View>
              <View style={[styles.subtasksCountPill, { backgroundColor: primaryTint, borderColor: `${colors.primary}20` }]}> 
                <Text style={[styles.subtasksCount, { color: colors.primary }]}>{subtaskInputs.length}</Text>
              </View>
            </View>

            {subtaskInputs.map((subtask, index) => (
              <View key={subtask.id} style={[styles.subtaskCard, { backgroundColor: surfaceElevated, borderColor: fieldBorder }]}> 
                <View style={styles.subtaskHeader}>
                  <View style={styles.subtaskHeaderLeft}>
                    <View style={[styles.subtaskDot, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.subtaskLabel, { color: colors.mutedText }]}>Step {index + 1}</Text>
                  </View>
                  {subtaskInputs.length > 1 && (
                    <TouchableOpacity
                      style={[styles.removeSubtaskButton, { backgroundColor: `${colors.danger}14` }]}
                      onPress={() => removeSubtaskInput(subtask.id)}
                      disabled={isSubmitting}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="close" size={16} color={colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>

                <TextInput
                  style={[styles.subtaskInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,74,173,0.04)', borderColor: fieldBorder, color: colors.text }]}
                  placeholder="Subtask title"
                  placeholderTextColor={colors.mutedText}
                  value={subtask.title}
                  onChangeText={(text) => updateSubtaskTitle(subtask.id, text)}
                  editable={!isSubmitting}
                />

                <TextInput
                  style={[styles.subtaskInput, styles.subtaskDescriptionInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,74,173,0.04)', borderColor: fieldBorder, color: colors.text }]}
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

            <TouchableOpacity
              style={[styles.addSubtaskButton, { borderColor: `${colors.primary}40`, backgroundColor: primaryTint }]}
              onPress={addSubtaskInput}
              disabled={isSubmitting}
              activeOpacity={0.72}
            >
              <MaterialIcons name="add-circle-outline" size={19} color={colors.primary} />
              <Text style={[styles.addSubtaskText, { color: colors.primary }]}>Add Another Step</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Create Task CTA */}
        <View style={[styles.ctaContainer, { borderTopColor: fieldBorder }]}>
          <Animated.View style={[styles.ctaWrap, { transform: [{ scale: ctaScale }] }]}>
            <TouchableOpacity
              onPress={handleSave}
              onPressIn={() => animateCta(0.975)}
              onPressOut={() => animateCta(1)}
              disabled={isSubmitting}
              activeOpacity={0.9}
              style={[styles.ctaButton, { opacity: isSubmitting ? 0.7 : 1, shadowColor: colors.primary }]}
            >
              <LinearGradient
                colors={['#0A5DCD', '#004AAD']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaGradient}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <MaterialIcons name="add-task" size={21} color="#FFFFFF" />
                )}
                <Text style={styles.ctaText}>
                  {isSubmitting ? 'Creating…' : 'Create Task'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={[styles.bottomNav, { backgroundColor: surfaceElevated, borderTopColor: cardBorder }]}>
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

  // Header
  headerContainer: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#004AAD',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  headerGlowTop: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  headerGlowBottom: {
    position: 'absolute',
    bottom: -30,
    left: -10,
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  headerContent: {
    position: 'relative',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 3,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.1,
  },

  // Scroll Content
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 155,
  },

  // Form notice
  formNotice: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
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
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 5,
  },
  aiAssistIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiAssistBody: {
    flex: 1,
  },
  aiAssistText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  aiAssistHint: {
    fontSize: 12,
    marginTop: 2,
  },
  aiAssistArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiAssistModalCard: {
    marginHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    marginBottom: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  aiAssistModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  aiAssistModalIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  aiAssistModalTitleWrap: {
    flex: 1,
  },
  aiAssistModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  aiAssistModalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  aiAssistInput: {
    borderWidth: 1,
    borderRadius: 13,
    minHeight: 116,
    textAlignVertical: 'top',
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
  },
  aiAssistError: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
  },
  aiAssistVoiceRow: {
    marginTop: 10,
  },
  aiAssistMicButton: {
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  aiAssistMicText: {
    fontSize: 13,
    fontWeight: '700',
  },
  aiAssistRecordingHint: {
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '600',
  },
  aiAssistActions: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  aiAssistSecondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  aiAssistSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  aiAssistPrimaryButton: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  aiAssistPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Form field grouping
  field: {
    marginBottom: 20,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  fieldLabelHelper: {
    fontSize: 12,
    fontWeight: '500',
  },
  fieldRowLeft: {
    flex: 1,
    marginRight: 14,
  },
  appInputContainer: {
    marginBottom: 0,
  },
  textAreaInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },

  // Due Date
  dueDateCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#004AAD',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  dateFieldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  dateFieldIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dateFieldTextWrap: {
    flex: 1,
  },
  dateFieldText: {
    fontSize: 15,
    fontWeight: '700',
  },
  dateFieldSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  dateQuickDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 15,
  },
  dateQuickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  dateQuickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
  },
  dateQuickChipText: {
    fontSize: 13,
    fontWeight: '700',
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: 20,
    paddingTop: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
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

  // Priority chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  priorityChip: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
  },
  priorityChipText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Status
  statusButton: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  statusIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  statusHelper: {
    fontSize: 12,
    marginRight: 2,
  },
  statusChevron: {
    marginLeft: 'auto',
  },
  dropdownMenu: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#004AAD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 15,
    gap: 12,
  },
  dropdownOptionIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownOptionContent: {
    flex: 1,
  },
  dropdownOptionText: {
    fontSize: 15,
  },
  dropdownHelperText: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },

  // Subtasks Toggle
  subtasksToggleCard: {
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#004AAD',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  subtasksToggleIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtasksToggleHint: {
    fontSize: 12,
    marginTop: 1,
  },

  // Subtasks Section
  subtasksSection: {
    marginBottom: 20,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#004AAD',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  subtasksHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  subtasksSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  subtasksSectionHint: {
    fontSize: 12,
    marginTop: 2,
  },
  subtasksCountPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  subtasksCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  subtaskCard: {
    borderRadius: 13,
    padding: 13,
    marginBottom: 10,
    borderWidth: 1,
  },
  subtaskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  subtaskHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subtaskDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.7,
  },
  subtaskLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subtaskInput: {
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
    marginBottom: 10,
  },
  subtaskDescriptionInput: {
    minHeight: 64,
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
    gap: 7,
  },
  addSubtaskText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // CTA
  ctaContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 18,
    paddingBottom: 14,
    marginTop: 8,
  },
  ctaWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#004AAD',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 6,
  },
  ctaButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 17,
    paddingHorizontal: 24,
    gap: 9,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
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
    borderTopWidth: StyleSheet.hairlineWidth,
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
  navTextActive: {},
});