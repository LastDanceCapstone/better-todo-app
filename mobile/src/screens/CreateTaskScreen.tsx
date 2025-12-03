import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';

// Update the API base URL to match your current IP
const API_BASE_URL = 'http://100.100.66.131:3000';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
type Status = 'ACTIVE' | 'COMPLETED';

interface SubtaskInput {
  id: string;
  title: string;
  description?: string;
}

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

// Format date as MM-DD-YYYY for display
const formatDateForDisplay = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}-${day}-${year}`;
};

export default function CreateTaskScreen({ navigation }: any) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [status, setStatus] = useState<Status>('ACTIVE');
  const [dueDate, setDueDate] = useState('');
  const [hasSubtasks, setHasSubtasks] = useState(false);
  const [subtaskInputs, setSubtaskInputs] = useState<SubtaskInput[]>([
    { id: `subtask-${Date.now()}`, title: '', description: '' },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeNav, setActiveNav] = useState('Create');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  const onDateChange = (event: any, date?: Date) => {
    // Close picker on Android after selection or cancel
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    // Only update date if user selected one (not cancelled)
    if (event.type === 'set' && date) {
      setSelectedDate(date);
      const formattedDate = formatDateForDisplay(date);
      setDueDate(formattedDate);
      
      // Close picker on iOS after selection
      if (Platform.OS === 'ios') {
        setShowDatePicker(false);
      }
    } else if (event.type === 'dismissed') {
      // User cancelled, just close picker
      setShowDatePicker(false);
    }
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

      const normalizedDueDate = normalizeDate(dueDate);

      // Prepare task data for backend
      const taskData = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        status,
        dueDate: normalizedDueDate,
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
                isCompleted: false,
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
        setStatus('ACTIVE');
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
    <SafeAreaView style={styles.container}>
      {/* Header - Card-like with soft background, subtle shadow */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Create Task</Text>
        <Text style={styles.headerSubtitle}>
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
          <Text style={styles.label}>Task Title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Complete Math Homework"
            placeholderTextColor="#9CA3AF"
            value={title}
            onChangeText={setTitle}
            editable={!isSubmitting}
          />
        </View>

        {/* Description Field */}
        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <Text style={styles.helperText}>Optional</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Add more details about this task"
            placeholderTextColor="#9CA3AF"
            value={description}
            onChangeText={setDescription}
            multiline
            editable={!isSubmitting}
          />
        </View>

        {/* Due Date Field */}
        <View style={styles.field}>
          <Text style={styles.label}>Due Date</Text>
          <View style={styles.dateInputContainer}>
            <TextInput
              style={[styles.input, styles.dateInput]}
              placeholder="MM-DD-YYYY or 12-31-2024"
              placeholderTextColor="#9CA3AF"
              value={dueDate}
              onChangeText={setDueDate}
              editable={!isSubmitting}
            />
            <TouchableOpacity 
              style={styles.calendarButton}
              onPress={() => setShowDatePicker(!showDatePicker)}
              disabled={isSubmitting}
              activeOpacity={0.7}
            >
              <MaterialIcons 
                name={showDatePicker ? "close" : "calendar-today"} 
                size={22} 
                color={showDatePicker ? "#FF4D4D" : "#6B7280"} 
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.helperText}>
            Example: 12-31-2024, or click calendar to select
          </Text>
        </View>

        {/* Date Picker - Native Component */}
        {showDatePicker && (
          <>
            {Platform.OS === 'ios' && (
              <View style={styles.iosDatePickerContainer}>
                <View style={styles.iosDatePickerHeader}>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.iosDatePickerButton}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => {
                    const formattedDate = formatDateForDisplay(selectedDate);
                    setDueDate(formattedDate);
                    setShowDatePicker(false);
                  }}>
                    <Text style={[styles.iosDatePickerButton, styles.iosDatePickerDone]}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="inline"
                  onChange={(event, date) => {
                    if (date) setSelectedDate(date);
                  }}
                  minimumDate={new Date()}
                />
              </View>
            )}
            
            {Platform.OS === 'android' && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="calendar"
                onChange={onDateChange}
                minimumDate={new Date()}
              />
            )}
          </>
        )}

        {/* Priority Field */}
        <View style={styles.field}>
          <Text style={styles.label}>Priority</Text>
          <TouchableOpacity 
            style={styles.dropdownButton}
            onPress={() => setShowPriorityPicker(!showPriorityPicker)}
            disabled={isSubmitting}
            activeOpacity={0.7}
          >
            <Text style={styles.dropdownText}>
              {priority.charAt(0) + priority.slice(1).toLowerCase()}
            </Text>
            <MaterialIcons 
              name={showPriorityPicker ? "arrow-drop-up" : "arrow-drop-down"} 
              size={24} 
              color="#6B7280" 
            />
          </TouchableOpacity>
          
          {/* Priority Dropdown Options */}
          {showPriorityPicker && (
            <View style={styles.dropdownMenu}>
              {(['LOW', 'MEDIUM', 'HIGH'] as Priority[]).map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.dropdownOption,
                    priority === level && styles.dropdownOptionActive,
                  ]}
                  onPress={() => {
                    setPriority(level);
                    setShowPriorityPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dropdownOptionText,
                      priority === level && styles.dropdownOptionTextActive,
                    ]}
                  >
                    {level.charAt(0) + level.slice(1).toLowerCase()}
                  </Text>
                  {priority === level && (
                    <MaterialIcons name="check" size={20} color="#2563EB" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Status Field */}
        <View style={styles.field}>
          <Text style={styles.label}>Status</Text>
          <TouchableOpacity 
            style={styles.dropdownButton}
            onPress={() => setShowStatusPicker(!showStatusPicker)}
            disabled={isSubmitting}
            activeOpacity={0.7}
          >
            <Text style={styles.dropdownText}>
              {status.charAt(0) + status.slice(1).toLowerCase()}
            </Text>
            <MaterialIcons 
              name={showStatusPicker ? "arrow-drop-up" : "arrow-drop-down"} 
              size={24} 
              color="#6B7280" 
            />
          </TouchableOpacity>
          
          {/* Status Dropdown Options */}
          {showStatusPicker && (
            <View style={styles.dropdownMenu}>
              {(['ACTIVE', 'COMPLETED'] as Status[]).map((statusOption) => (
                <TouchableOpacity
                  key={statusOption}
                  style={[
                    styles.dropdownOption,
                    status === statusOption && styles.dropdownOptionActive,
                  ]}
                  onPress={() => {
                    setStatus(statusOption);
                    setShowStatusPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dropdownOptionText,
                      status === statusOption && styles.dropdownOptionTextActive,
                    ]}
                  >
                    {statusOption.charAt(0) + statusOption.slice(1).toLowerCase()}
                  </Text>
                  {status === statusOption && (
                    <MaterialIcons name="check" size={20} color="#2563EB" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Subtasks Toggle */}
        <View style={styles.fieldRow}>
          <View style={styles.fieldRowLeft}>
            <Text style={styles.label}>Enable Subtasks</Text>
            <Text style={styles.helperText}>
              Break down this task into smaller steps.
            </Text>
          </View>
          <Switch 
            value={hasSubtasks} 
            onValueChange={toggleSubtasks}
            disabled={isSubmitting}
            trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
            thumbColor={hasSubtasks ? '#2563EB' : '#F3F4F6'}
            ios_backgroundColor="#D1D5DB"
          />
        </View>

        {/* Subtasks Section */}
        {hasSubtasks && (
          <View style={styles.subtasksSection}>
            <Text style={styles.subtasksSectionTitle}>Subtasks</Text>
            
            {subtaskInputs.map((subtask, index) => (
              <View key={subtask.id} style={styles.subtaskCard}>
                {/* Subtask Header */}
                <View style={styles.subtaskHeader}>
                  <Text style={styles.subtaskLabel}>Subtask {index + 1}</Text>
                  {subtaskInputs.length > 1 && (
                    <TouchableOpacity
                      style={styles.removeSubtaskButton}
                      onPress={() => removeSubtaskInput(subtask.id)}
                      disabled={isSubmitting}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="close" size={20} color="#FF4D4D" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Subtask Title Input */}
                <TextInput
                  style={styles.subtaskInput}
                  placeholder="Subtask title"
                  placeholderTextColor="#9CA3AF"
                  value={subtask.title}
                  onChangeText={(text) => updateSubtaskTitle(subtask.id, text)}
                  editable={!isSubmitting}
                />

                {/* Subtask Description Input (Optional) */}
                <TextInput
                  style={[styles.subtaskInput, styles.subtaskDescriptionInput]}
                  placeholder="Description (optional)"
                  placeholderTextColor="#9CA3AF"
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
              style={styles.addSubtaskButton}
              onPress={addSubtaskInput}
              disabled={isSubmitting}
              activeOpacity={0.7}
            >
              <MaterialIcons name="add-circle-outline" size={20} color="#2563EB" />
              <Text style={styles.addSubtaskText}>Add Another Subtask</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Create Task Button */}
        <TouchableOpacity 
          style={[styles.createButton, isSubmitting && styles.createButtonDisabled]} 
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

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Navigation - Matches HomeScreen style */}
      <View style={styles.bottomNav}>
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
            color={activeNav === 'Home' ? '#2563EB' : '#6B7280'}
          />
          <Text
            style={[
              styles.navText,
              activeNav === 'Home' && styles.navTextActive,
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
            color={activeNav === 'Create' ? '#2563EB' : '#6B7280'}
          />
          <Text
            style={[
              styles.navText,
              activeNav === 'Create' && styles.navTextActive,
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
            color={activeNav === 'Calendar' ? '#2563EB' : '#6B7280'}
          />
          <Text
            style={[
              styles.navText,
              activeNav === 'Calendar' && styles.navTextActive,
            ]}
          >
            Calendar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            setActiveNav('Account');
            navigation.navigate('AccountDetails');
          }}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name="account-circle"
            size={26}
            color={activeNav === 'Account' ? '#2563EB' : '#6B7280'}
          />
          <Text
            style={[
              styles.navText,
              activeNav === 'Account' && styles.navTextActive,
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
    backgroundColor: '#FFFFFF',
  },

  // Header - Card-like with soft background, subtle shadow
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#F9FAFB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  headerTitle: { 
    fontSize: 24, 
    fontWeight: '700', 
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: { 
    fontSize: 14, 
    color: '#6B7280',
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
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fieldRowLeft: {
    flex: 1,
    marginRight: 16,
  },
  label: { 
    fontSize: 16,
    fontWeight: '700',
    color: '#111827', 
    marginBottom: 8,
  },
  helperText: { 
    fontSize: 13, 
    color: '#6B7280',
    marginTop: 6,
    lineHeight: 18,
  },

  // Inputs
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
  },
  textArea: { 
    minHeight: 100, 
    textAlignVertical: 'top',
  },

  // Date Input
  dateInputContainer: {
    position: 'relative',
  },
  dateInput: {
    paddingRight: 50,
  },
  calendarButton: {
    position: 'absolute',
    right: 14,
    top: 14,
    padding: 4,
  },

  // iOS Date Picker
  iosDatePickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iosDatePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  iosDatePickerButton: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  iosDatePickerDone: {
    color: '#2563EB',
  },

  // Dropdown
  dropdownButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  dropdownMenu: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dropdownOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownOptionActive: {
    backgroundColor: '#EFF6FF',
  },
  dropdownOptionText: {
    fontSize: 15,
    color: '#111827',
  },
  dropdownOptionTextActive: {
    color: '#2563EB',
    fontWeight: '600',
  },

  // Subtasks Section
  subtasksSection: {
    marginBottom: 24,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  subtasksSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  subtaskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    color: '#6B7280',
  },
  subtaskInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
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
    backgroundColor: 'rgba(255, 77, 77, 0.1)',
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
    borderColor: '#2563EB',
    borderStyle: 'dashed',
    backgroundColor: '#EFF6FF',
    marginTop: 4,
  },
  addSubtaskText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563EB',
    marginLeft: 8,
  },

  // Create Button
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
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
    backgroundColor: '#93C5FD',
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
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.04)',
  },
  navItem: { 
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  navText: { 
    fontSize: 11, 
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 4,
  },
  navTextActive: { 
    color: '#2563EB',
  },
});