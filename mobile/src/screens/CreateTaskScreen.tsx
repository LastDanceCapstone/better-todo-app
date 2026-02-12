import React, { useRef, useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

// Update the API base URL to match your current IP
const API_BASE_URL = 'https://prioritize-production-3835.up.railway.app';

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
    const month = m.padStart(2, '0');
    const day = d.padStart(2, '0');
    return new Date(`${y}-${month}-${day}T23:59:59Z`).toISOString();
  }

  // YYYY-MM-DD format (convert to ISO)
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(value + 'T23:59:59Z').toISOString();
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

export default function CreateTaskScreen({ navigation }: any) {
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
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const modalTranslateY = useRef(new Animated.Value(40)).current;

  const onDateChange = (event: any, date?: Date) => {
    if (event.type === 'set' && date) {
      setSelectedDate(date);
      setDueDate(date.toISOString());
    }

    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
  };

  const openDatePicker = () => {
    if (dueDate) {
      const parsed = new Date(dueDate);
      if (!isNaN(parsed.getTime())) {
        setSelectedDate(parsed);
      }
    } else {
      setSelectedDate(new Date());
    }

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: dueDate ? new Date(dueDate) : new Date(),
        mode: 'date',
        display: 'calendar',
        onChange: onDateChange,
        minimumDate: new Date(),
      });
      return;
    }

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
      ]).start(() => setShowDatePicker(false));
      return;
    }

    setShowDatePicker(false);
  };

  const handleClearDate = () => {
    setDueDate('');
    setSelectedDate(new Date());
  };

  const handleToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setDueDate(today.toISOString());
  };

  const handleTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedDate(tomorrow);
    setDueDate(tomorrow.toISOString());
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
      // Get token from AsyncStorage
      const token = await AsyncStorage.getItem('authToken');
      
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

      // Create task via API
      const response = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
      });

      const data = await response.json();
      console.log('Task creation response:', data);

      if (response.ok) {
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

        // Clear form
        setTitle('');
        setDescription('');
        setPriority('MEDIUM');
        setStatus('TODO');
        setDueDate('');
        setHasSubtasks(false);
        setSubtaskInputs([{ id: `subtask-${Date.now()}`, title: '', description: '' }]);
        
        // Show success message
        Alert.alert(
          'Success',
          hasSubtasks
            ? 'Task created with subtasks!'
            : 'Task created successfully!',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Home', { refresh: true }),
            },
          ]
        );
      } else {
        if (response.status === 401) {
          Alert.alert('Session Expired', 'Please log in again.');
          navigation.replace('Login');
        } else {
          Alert.alert('Error', data.error || 'Failed to create task');
        }
      }
    } catch (error) {
      console.error('Error creating task:', error);
      Alert.alert('Error', 'Failed to create task. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header - Card-like with soft background, subtle shadow */}
      <View style={[styles.headerContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Create Task</Text>
        <Text style={[styles.headerSubtitle, { color: colors.mutedText }]}>
          Add a new task, set priority, status, and due date.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Title Field */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Task Title</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            placeholder="e.g., Complete Math Homework"
            placeholderTextColor={colors.mutedText}
            value={title}
            onChangeText={setTitle}
            editable={!isSubmitting}
          />
        </View>

        {/* Description Field */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Description</Text>
          <Text style={[styles.helperText, { color: colors.mutedText }]}>Optional</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            placeholder="Add more details about this task"
            placeholderTextColor={colors.mutedText}
            value={description}
            onChangeText={setDescription}
            multiline
            editable={!isSubmitting}
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
            <Text
              style={[
                styles.dateFieldText,
                { color: dueDate ? colors.text : colors.mutedText },
              ]}
            >
              {dueDate ? formatDateForDisplayLong(new Date(dueDate)) : 'Select a date'}
            </Text>
            <MaterialIcons name="calendar-today" size={20} color={colors.mutedText} />
          </TouchableOpacity>
          <Text style={[styles.helperText, { color: colors.mutedText }]}>Optional - tap to select</Text>
          <View style={styles.dateQuickActions}>
            <TouchableOpacity
              onPress={handleToday}
              style={[styles.dateQuickActionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.dateQuickActionText, { color: colors.text }]}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleTomorrow}
              style={[styles.dateQuickActionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.dateQuickActionText, { color: colors.text }]}>Tomorrow</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleClearDate}
              style={[styles.dateQuickActionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
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
                  <TouchableOpacity onPress={closeDatePicker}>
                    <Text style={[styles.sheetActionText, { color: colors.primary }]}>Done</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.datePickerContainer}>
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display="spinner"
                    onChange={onDateChange}
                    minimumDate={new Date()}
                    textColor={colors.text}
                    style={styles.datePicker}
                  />
                </View>
              </Animated.View>
            </View>
          </Modal>
        )}

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
              {(Object.keys(STATUS_META) as Status[]).map((statusOption) => (
                <TouchableOpacity
                  key={statusOption}
                  style={[
                    styles.dropdownOption,
                    status === statusOption && [styles.dropdownOptionActive, { backgroundColor: colors.primary + '15' }],
                    { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
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
                      color={status === statusOption ? colors.primary : colors.mutedText}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          status === statusOption && [styles.dropdownOptionTextActive, { color: colors.primary }],
                          { color: status === statusOption ? colors.primary : colors.text },
                        ]}
                      >
                        {STATUS_META[statusOption].label}
                      </Text>
                      {STATUS_META[statusOption].helper ? (
                        <Text style={[styles.helperText, { color: colors.mutedText, marginTop: 2 }]}> 
                          {STATUS_META[statusOption].helper}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View
                    style={[
                      styles.dropdownCheckWrap,
                      { opacity: status === statusOption ? 1 : 0 },
                    ]}
                  >
                    <MaterialIcons name="check" size={20} color={colors.primary} />
                  </View>
                </TouchableOpacity>
              ))}
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
              <Text style={[styles.subtasksSectionTitle, { color: colors.text }]}>Subtasks</Text>
              <Text style={[styles.subtasksCount, { color: colors.mutedText }]}>{subtaskInputs.length}</Text>
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
                      style={[styles.removeSubtaskButton, { backgroundColor: colors.danger + '15' }]}
                      onPress={() => removeSubtaskInput(subtask.id)}
                      disabled={isSubmitting}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="close" size={20} color={colors.danger} />
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
            <TouchableOpacity
              style={[styles.addSubtaskButton, { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
              onPress={addSubtaskInput}
              disabled={isSubmitting}
              activeOpacity={0.7}
            >
              <MaterialIcons name="add-circle-outline" size={20} color={colors.primary} />
              <Text style={[styles.addSubtaskText, { color: colors.primary }]}>Add Another Subtask</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Create Task Button */}
        <View style={[styles.ctaContainer, { borderTopColor: colors.border }]}> 
          <TouchableOpacity 
            style={[styles.createButton, { backgroundColor: colors.primary }, isSubmitting && styles.createButtonDisabled]} 
            onPress={handleSave}
            disabled={isSubmitting}
            activeOpacity={0.7}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <MaterialIcons name="add-task" size={20} color="#FFFFFF" />
                <Text style={styles.createButtonText}>Create Task</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 120 }} />
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
            Alert.alert('Coming Soon', 'Calendar screen is not built yet');
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
    paddingTop: 16,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  headerTitle: { 
    fontSize: 24, 
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: { 
    fontSize: 14,
    lineHeight: 20,
  },

  // Scroll Content
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // Form Fields
  field: { 
    marginBottom: 24,
  },
  fieldRow: {
    marginBottom: 24,
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
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  helperText: { 
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
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

  // Due Date Field
  dateFieldButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateFieldText: {
    fontSize: 15,
    fontWeight: '500',
  },
  dateQuickActions: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dateQuickActionButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
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

  // Dropdown
  dropdownButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: 15,
    fontWeight: '500',
  },
  dropdownMenu: {
    marginTop: 8,
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
    paddingVertical: 14,
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
    gap: 10,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Subtasks Section
  subtasksSection: {
    marginBottom: 24,
    borderRadius: 12,
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
  subtasksCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  subtaskCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  subtaskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  subtaskLabel: {
    fontSize: 14,
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
    width: 28,
    height: 28,
    borderRadius: 14,
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
    paddingTop: 12,
    paddingBottom: 8,
    marginTop: 8,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
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
    bottom: 0,
    left: 0,
    right: 0,
    height: 72,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
    borderTopWidth: 1,
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