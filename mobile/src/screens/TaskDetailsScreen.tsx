// src/screens/TaskDetailsScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';


const API_BASE_URL = 'XXXXXXXXXXX';

type Subtask = {
  id: string;
  title: string;
  description?: string;
  isCompleted: boolean;
  createdAt: string;
};

type Task = {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  status: 'ACTIVE' | 'COMPLETED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: string;
  updatedAt: string;
  subtasks?: Subtask[];
};

export default function TaskDetailsScreen({ route, navigation }: any) {
  const [task, setTask] = useState<Task | null>(route.params?.task || null);
  const [loading, setLoading] = useState(false);

  // Format date helper
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No date set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
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

  if (!task) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={styles.errorText}>Task not found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backIcon}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Task Details</Text>
        <TouchableOpacity
          style={styles.moreIcon}
          onPress={() => Alert.alert('Menu', 'Edit and delete options coming soon')}
        >
          <MaterialIcons name="more-vert" size={24} color="#000000" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Task Title */}
        <View style={styles.titleSection}>
          <Text style={styles.taskTitle}>{task.title}</Text>
          {task.priority && (
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
          )}
        </View>

        {/* Status Badge */}
        <View style={styles.statusSection}>
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
              size={16}
              color={task.status === 'COMPLETED' ? '#00C853' : '#4E8FFF'}
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
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <View style={styles.descriptionBox}>
            <Text style={styles.descriptionText}>
              {task.description || 'No description provided'}
            </Text>
          </View>
        </View>

        {/* Due Date */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Due Date</Text>
          <View style={styles.infoBox}>
            <MaterialIcons name="event" size={20} color="#4E8FFF" />
            <View style={styles.infoContent}>
              <Text style={styles.infoMainText}>{formatRelativeDate(task.dueDate)}</Text>
              <Text style={styles.infoSubText}>{formatDate(task.dueDate)}</Text>
            </View>
          </View>
        </View>

        {/* Subtasks */}
        {task.subtasks && task.subtasks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Subtasks ({task.subtasks.filter((st) => st.isCompleted).length}/
              {task.subtasks.length} completed)
            </Text>
            {task.subtasks.map((subtask) => (
              <View key={subtask.id} style={styles.subtaskItem}>
                <TouchableOpacity
                  style={styles.subtaskCheckbox}
                  onPress={() => Alert.alert('Info', 'Subtask toggle coming soon')}
                >
                  <MaterialIcons
                    name={subtask.isCompleted ? 'check-circle' : 'radio-button-unchecked'}
                    size={24}
                    color={subtask.isCompleted ? '#00C853' : '#9CA3AF'}
                  />
                </TouchableOpacity>
                <View style={styles.subtaskContent}>
                  <Text
                    style={[
                      styles.subtaskTitle,
                      subtask.isCompleted && styles.subtaskTitleCompleted,
                    ]}
                  >
                    {subtask.title}
                  </Text>
                  {subtask.description && (
                    <Text style={styles.subtaskDescription}>{subtask.description}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Task Metadata */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Task Information</Text>
          <View style={styles.metadataBox}>
            <View style={styles.metadataItem}>
              <MaterialIcons name="schedule" size={16} color="#9CA3AF" />
              <Text style={styles.metadataLabel}>Created</Text>
              <Text style={styles.metadataValue}>
                {new Date(task.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.metadataItem}>
              <MaterialIcons name="update" size={16} color="#9CA3AF" />
              <Text style={styles.metadataLabel}>Last Updated</Text>
              <Text style={styles.metadataValue}>
                {new Date(task.updatedAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              task.status === 'COMPLETED' ? styles.actionButtonSecondary : styles.actionButtonPrimary,
            ]}
            onPress={() => Alert.alert('Info', 'Task status update coming soon')}
          >
            <MaterialIcons
              name={task.status === 'COMPLETED' ? 'undo' : 'check-circle'}
              size={20}
              color={task.status === 'COMPLETED' ? '#000000' : '#FFFFFF'}
            />
            <Text
              style={[
                styles.actionButtonText,
                task.status === 'COMPLETED' && styles.actionButtonTextSecondary,
              ]}
            >
              {task.status === 'COMPLETED' ? 'Mark as Active' : 'Mark as Completed'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backIcon: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  moreIcon: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  titleSection: {
    marginBottom: 20,
  },
  taskTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusSection: {
    marginBottom: 24,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusActive: {
    backgroundColor: 'rgba(78, 143, 255, 0.1)',
  },
  statusCompleted: {
    backgroundColor: 'rgba(0, 200, 83, 0.1)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  statusTextActive: {
    color: '#4E8FFF',
  },
  statusTextCompleted: {
    color: '#00C853',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  descriptionBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  descriptionText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoMainText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  infoSubText: {
    fontSize: 12,
    color: '#6B7280',
  },
  subtaskItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  subtaskCheckbox: {
    marginRight: 12,
    marginTop: 2,
  },
  subtaskContent: {
    flex: 1,
  },
  subtaskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  subtaskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  subtaskDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  metadataBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  metadataLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
    marginRight: 'auto',
  },
  metadataValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  actionsSection: {
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  actionButtonPrimary: {
    backgroundColor: '#4E8FFF',
  },
  actionButtonSecondary: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  actionButtonTextSecondary: {
    color: '#000000',
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#4E8FFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

