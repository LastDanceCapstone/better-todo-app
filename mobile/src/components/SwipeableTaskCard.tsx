import React, { useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { MaterialIcons } from '@expo/vector-icons';
import SubtaskProgress from './SubtaskProgress';

interface Task {
  id: string;
  title: string;
  description: string;
  dueDate?: string;
  status: 'ACTIVE' | 'COMPLETED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  subtasks?: Array<{ id: string; title: string; isCompleted: boolean }>;
}

interface SwipeableTaskCardProps {
  task: Task;
  onPress: () => void;
  onStatusChange: (taskId: string, newStatus: 'ACTIVE' | 'COMPLETED') => void;
  formatDueDate: (dueDate?: string) => string;
  formatDisplayDate: (dueDate?: string) => string;
}

export default function SwipeableTaskCard({
  task,
  onPress,
  onStatusChange,
  formatDueDate,
  formatDisplayDate,
}: SwipeableTaskCardProps) {
  const swipeableRef = useRef<Swipeable>(null);

  // Right swipe action (for ACTIVE tasks -> mark as COMPLETED)
  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.rightAction}>
        <Animated.View style={[styles.actionContent, { transform: [{ scale }] }]}>
          <MaterialIcons name="check-circle" size={32} color="#FFFFFF" />
          <Text style={styles.actionText}>Complete</Text>
        </Animated.View>
      </View>
    );
  };

  // Left swipe action (for COMPLETED tasks -> mark as ACTIVE)
  const renderLeftActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [0, 100],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.leftAction}>
        <Animated.View style={[styles.actionContent, { transform: [{ scale }] }]}>
          <MaterialIcons name="undo" size={32} color="#FFFFFF" />
          <Text style={styles.actionText}>Reactivate</Text>
        </Animated.View>
      </View>
    );
  };

  const handleSwipeComplete = (direction: 'left' | 'right') => {
    const newStatus = direction === 'right' ? 'COMPLETED' : 'ACTIVE';
    
    // Directly change status without confirmation
    onStatusChange(task.id, newStatus);
    swipeableRef.current?.close();
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={task.status === 'ACTIVE' ? renderRightActions : undefined}
      renderLeftActions={task.status === 'COMPLETED' ? renderLeftActions : undefined}
      onSwipeableOpen={(direction) => handleSwipeComplete(direction as 'left' | 'right')}
      overshootRight={false}
      overshootLeft={false}
      rightThreshold={80}
      leftThreshold={80}
    >
      <TouchableOpacity
        style={styles.taskCard}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {/* Priority Tag */}
        {task.priority && (
          <View style={[styles.badge, styles[`priority${task.priority}`]]}>
            <Text style={[styles.badgeText, styles[`priorityText${task.priority}`]]}>
              {task.priority}
            </Text>
          </View>
        )}

        {/* Task Content */}
        <View>
          <Text style={styles.taskTitle}>{task.title}</Text>
          <Text style={styles.taskDescription}>
            {task.description || 'No description'}
          </Text>
        </View>

        {/* Black Line */}
        <View style={styles.separator} />

        {/* Bottom Section */}
        <View style={styles.taskFooter}>
          {/* Left side: Days left */}
          <View style={styles.dateInfo}>
            <MaterialIcons name="access-time" size={16} color="grey" />
            <Text style={styles.timeLeft}>{formatDueDate(task.dueDate)}</Text>
          </View>

          {/* Right side: Due date */}
          <Text style={styles.dueDate}>
            Due: {formatDisplayDate(task.dueDate)}
          </Text>
        </View>

        {/* Subtask Progress Circle */}
        {task.subtasks && task.subtasks.length > 0 && (
          <View style={styles.progressContainer}>
            <SubtaskProgress subtasks={task.subtasks} size={50} strokeWidth={4} />
          </View>
        )}
      </TouchableOpacity>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 6,
  },
  taskDescription: {
    fontSize: 12,
    color: '#000000',
    marginTop: 4,
    lineHeight: 18,
  },
  separator: {
    height: 1,
    backgroundColor: '#000000',
    marginVertical: 12,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeLeft: {
    fontSize: 12,
    color: 'grey',
    marginLeft: 6,
  },
  dueDate: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
  },
  progressContainer: {
    marginTop: 16,
    alignSelf: 'flex-start',
    paddingTop: 8,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  priorityHIGH: { backgroundColor: 'rgba(255, 53, 53, 0.3)' },
  priorityMEDIUM: { backgroundColor: 'rgba(255, 184, 0, 0.3)' },
  priorityLOW: { backgroundColor: 'rgba(0, 200, 83, 0.3)' },
  priorityTextHIGH: { color: '#FF4D4D' },
  priorityTextMEDIUM: { color: '#FFB800' },
  priorityTextLOW: { color: '#00C853' },
  rightAction: {
    backgroundColor: '#00C853',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    marginBottom: 16,
    marginRight: 16,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  leftAction: {
    backgroundColor: '#4E8FFF',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 16,
    marginLeft: 16,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  actionContent: {
    alignItems: 'center',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
});