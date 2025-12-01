// app/create.tsx
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
type TaskStatus = 'ACTIVE' | 'COMPLETED';

type Task = {
  id: string;
  title: string;
  description: string;
  dueDate?: string; // stored as YYYY-MM-DD
  status: TaskStatus;
  priority?: Priority;
  tags?: string[];
  subtasks?: string[];
};

// Convert user input into YYYY-MM-DD if possible
const normalizeDate = (input: string): string | undefined => {
  if (!input) return undefined;

  const value = input.trim();
  if (!value) return undefined;

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  // MM/DD/YYYY or M/D/YYYY or with -
  const mdy = value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mdy) {
    const [, m, d, y] = mdy;
    const month = m.padStart(2, '0');
    const day = d.padStart(2, '0');
    return `${y}-${month}-${day}`;
  }

  // Let JS try
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return undefined;
};

export default function CreateScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [hasSubtasks, setHasSubtasks] = useState(false);
  const [subtasks, setSubtasks] = useState('');

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a task title.');
      return;
    }

    const normalizedDueDate = normalizeDate(dueDate);

    const newTask: Task = {
      id: Date.now().toString(),
      title: title.trim(),
      description: description.trim(),
      dueDate: normalizedDueDate,
      status: 'ACTIVE',
      priority,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
      subtasks:
        hasSubtasks && subtasks.trim()
          ? subtasks
              .split('\n')
              .map((s) => s.replace(/^[-•]\s*/, '').trim())
              .filter((s) => s.length > 0)
          : [],
    };

    try {
      const json = await AsyncStorage.getItem('tasks');
      const existing: Task[] = json ? JSON.parse(json) : [];
      const updated = [...existing, newTask];

      await AsyncStorage.setItem('tasks', JSON.stringify(updated));

      Alert.alert(
        'Task Created',
        `Title: ${newTask.title}
Priority: ${newTask.priority}
Due: ${newTask.dueDate || 'None'}
Tags: ${newTask.tags && newTask.tags.length ? newTask.tags.join(', ') : 'None'}
Subtasks: ${
          newTask.subtasks && newTask.subtasks.length
            ? `${newTask.subtasks.length} item(s)`
            : 'None'
        }`,
        [
          {
            text: 'Go to Home',
            onPress: () => router.replace('/home'), // <<< go to dashboard, not login
          },
          { text: 'Stay Here' },
        ]
      );

      // Clear form
      setTitle('');
      setDescription('');
      setTags('');
      setPriority('MEDIUM');
      setDueDate('');
      setHasSubtasks(false);
      setSubtasks('');
    } catch (e) {
      console.error('Error saving task', e);
      Alert.alert('Error', 'Failed to save task. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Create Task</Text>
        <Text style={styles.headerSubtitle}>
          Add a new task, set priority, due date, and optional subtasks.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <View style={styles.field}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Complete Math Homework"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Add more details about this task"
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </View>

        {/* Tags */}
        <View style={styles.field}>
          <Text style={styles.label}>Tags</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., school, urgent (comma separated)"
            value={tags}
            onChangeText={setTags}
          />
        </View>

        {/* Priority */}
        <View style={styles.field}>
          <Text style={styles.label}>Priority</Text>
          <View style={styles.priorityRow}>
            {(['LOW', 'MEDIUM', 'HIGH'] as Priority[]).map((level) => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.priorityChip,
                  priority === level && styles.priorityChipActive,
                ]}
                onPress={() => setPriority(level)}
              >
                <Text
                  style={[
                    styles.priorityText,
                    priority === level && styles.priorityTextActive,
                  ]}
                >
                  {level.charAt(0) + level.slice(1).toLowerCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Due Date */}
        <View style={styles.field}>
          <Text style={styles.label}>Due Date</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD or 12/20/2025"
            value={dueDate}
            onChangeText={setDueDate}
          />
        </View>

        {/* Subtasks toggle */}
        <View style={styles.fieldRow}>
          <View>
            <Text style={styles.label}>Enable Subtasks</Text>
            <Text style={styles.helperText}>
              Turn on to add smaller steps for this task.
            </Text>
          </View>
          <Switch value={hasSubtasks} onValueChange={setHasSubtasks} />
        </View>

        {/* Subtasks textarea */}
        {hasSubtasks && (
          <View style={styles.field}>
            <Text style={styles.label}>Subtasks (one per line)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={'e.g.\n• Read chapter 1\n• Answer questions 1–10'}
              value={subtasks}
              onChangeText={setSubtasks}
              multiline
            />
          </View>
        )}

        {/* Save */}
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Create Task</Text>
        </TouchableOpacity>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.replace('/home')}
        >
          <MaterialIcons name="home" size={24} color="#000" />
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.replace('/create')}
        >
          <MaterialIcons name="add-circle" size={24} color="#2563EB" />
          <Text style={[styles.navText, styles.navTextActive]}>Create</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() =>
            Alert.alert('Coming soon', 'Calendar screen is not built yet')
          }
        >
          <MaterialIcons name="calendar-today" size={24} color="#000" />
          <Text style={styles.navText}>Calendar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() =>
            Alert.alert('Coming soon', 'Account screen is not built yet')
          }
        >
          <MaterialIcons name="person" size={24} color="#000" />
          <Text style={styles.navText}>Account</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#111827' },
  headerSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
  },
  field: { marginBottom: 16 },
  fieldRow: {
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 6 },
  helperText: { fontSize: 12, color: '#6B7280' },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  priorityChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  priorityText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  priorityTextActive: { color: '#FFFFFF' },
  saveButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 10,
    paddingHorizontal: 32,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  navItem: { alignItems: 'center' },
  navText: { fontSize: 12, color: '#000000', marginTop: 4 },
  navTextActive: { color: '#2563EB', fontWeight: '600' },
});
