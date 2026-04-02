import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme';
import { Swipeable } from 'react-native-gesture-handler';
import { MaterialIcons } from '@expo/vector-icons';
import SubtaskProgress from './SubtaskProgress';

interface Task {
  id: string;
  title: string;
  description?: string;
  dueAt?: string | null;
  completedAt?: string | null;
  statusChangedAt?: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  subtasks?: Array<{ id: string; title: string; status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' }>;
}

interface SwipeableTaskCardProps {
  task: Task;
  onPress: () => void;
  onStatusChange: (taskId: string, newStatus: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED') => void;
  formatDueDate: (dueAt?: string) => string;
  formatDisplayDate: (dueAt?: string) => string;
  isTransitioning?: boolean;
}

export default function SwipeableTaskCard({
  task,
  onPress,
  onStatusChange,
  formatDueDate,
  formatDisplayDate,
  isTransitioning = false,
}: SwipeableTaskCardProps) {
  const { colors } = useTheme();
  const swipeableRef = useRef<Swipeable>(null);
  const swipeActive = useRef(new Animated.Value(0)).current;
  const pressValue = useRef(new Animated.Value(0)).current;
  const transitionValue = useRef(new Animated.Value(isTransitioning ? 1 : 0)).current;

  const pressScale = pressValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.985],
  });

  const swipeScale = swipeActive.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.992],
  });

  const transitionScale = transitionValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.97],
  });

  const combinedScale = Animated.multiply(Animated.multiply(pressScale, swipeScale), transitionScale);

  useEffect(() => {
    if (!isTransitioning) {
      transitionValue.setValue(0);
      return;
    }

    Animated.sequence([
      Animated.timing(transitionValue, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(transitionValue, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isTransitioning, transitionValue]);

  // Right swipe action (for ACTIVE tasks -> mark as COMPLETED)
  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = progress.interpolate({
      inputRange: [0, 0.6, 1],
      outputRange: [0.84, 0.96, 1],
      extrapolate: 'clamp',
    });
    const translateX = dragX.interpolate({
      inputRange: [-140, -80, 0],
      outputRange: [0, 6, 24],
      extrapolate: 'clamp',
    });
    const opacity = progress.interpolate({
      inputRange: [0, 0.25, 1],
      outputRange: [0, 0.55, 1],
      extrapolate: 'clamp',
    });

    return (
      <View style={[styles.rightAction, { backgroundColor: `${colors.success}E6` }]}> 
        <Animated.View
          style={[
            styles.actionContent,
            {
              opacity,
              transform: [{ translateX }, { scale }],
            },
          ]}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <MaterialIcons name="check-circle" size={24} color="#FFFFFF" />
          </View>
          <Text style={[styles.actionText, { color: '#FFFFFF' }]}>Complete</Text>
        </Animated.View>
      </View>
    );
  };

  // Left swipe action (for COMPLETED tasks -> mark as ACTIVE)
  const renderLeftActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = progress.interpolate({
      inputRange: [0, 0.6, 1],
      outputRange: [0.84, 0.96, 1],
      extrapolate: 'clamp',
    });
    const translateX = dragX.interpolate({
      inputRange: [0, 80, 140],
      outputRange: [-24, -6, 0],
      extrapolate: 'clamp',
    });
    const opacity = progress.interpolate({
      inputRange: [0, 0.25, 1],
      outputRange: [0, 0.55, 1],
      extrapolate: 'clamp',
    });

    return (
      <View style={[styles.leftAction, { backgroundColor: `${colors.primary}E6` }]}> 
        <Animated.View
          style={[
            styles.actionContent,
            {
              opacity,
              transform: [{ translateX }, { scale }],
            },
          ]}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <MaterialIcons name="undo" size={24} color="#FFFFFF" />
          </View>
          <Text style={[styles.actionText, { color: '#FFFFFF' }]}>Reactivate</Text>
        </Animated.View>
      </View>
    );
  };

  const handleSwipeComplete = (direction: 'left' | 'right') => {
    const newStatus = direction === 'right' ? 'COMPLETED' : 'TODO';
    
    // Directly change status without confirmation
    onStatusChange(task.id, newStatus);
    swipeableRef.current?.close();
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={task.status === 'TODO' || task.status === 'IN_PROGRESS' ? renderRightActions : undefined}
      renderLeftActions={task.status === 'COMPLETED' ? renderLeftActions : undefined}
      onSwipeableOpen={(direction) => handleSwipeComplete(direction as 'left' | 'right')}
      onSwipeableWillOpen={() => {
        Animated.timing(swipeActive, {
          toValue: 1,
          duration: 130,
          useNativeDriver: true,
        }).start();
      }}
      onSwipeableWillClose={() => {
        Animated.timing(swipeActive, {
          toValue: 0,
          duration: 130,
          useNativeDriver: true,
        }).start();
      }}
      onSwipeableOpenStartDrag={() => {
        Animated.timing(swipeActive, {
          toValue: 1,
          duration: 90,
          useNativeDriver: true,
        }).start();
      }}
      onSwipeableCloseStartDrag={() => {
        Animated.timing(swipeActive, {
          toValue: 1,
          duration: 90,
          useNativeDriver: true,
        }).start();
      }}
      overshootRight={false}
      overshootLeft={false}
      rightThreshold={72}
      leftThreshold={72}
      friction={1.8}
    >
      <Animated.View
        style={[
          styles.taskCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            transform: [{ scale: combinedScale }],
            shadowOpacity: swipeActive.interpolate({
              inputRange: [0, 1],
              outputRange: [0.11, 0.2],
            }),
            shadowRadius: swipeActive.interpolate({
              inputRange: [0, 1],
              outputRange: [8, 12],
            }),
            elevation: swipeActive.interpolate({
              inputRange: [0, 1],
              outputRange: [3, 7],
            }),
          },
        ]}
      >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={1}
        onPressIn={() => {
          Animated.timing(pressValue, {
            toValue: 1,
            duration: 110,
            useNativeDriver: true,
          }).start();
        }}
        onPressOut={() => {
          Animated.timing(pressValue, {
            toValue: 0,
            duration: 140,
            useNativeDriver: true,
          }).start();
        }}
      >
        {/* Task Header */}
        <View style={styles.headerRow}>
          <View style={styles.textContent}>
            <Text style={[styles.taskTitle, { color: colors.text }]}>{task.title}</Text>
            <Text style={[styles.taskDescription, { color: colors.mutedText }]}>
              {task.description || 'No description'}
            </Text>
          </View>

          {/* Priority Tag */}
          {task.priority && (
            <View style={[styles.badge, styles[`priority${task.priority}`]]}>
              <Text style={[styles.badgeText, styles[`priorityText${task.priority}`]]}>
                {task.priority}
              </Text>
            </View>
          )}
        </View>

        {/* Black Line */}
        <View style={[styles.separator, { backgroundColor: colors.border }]} />

        {/* Bottom Section */}
        <View style={styles.taskFooter}>
          {/* Left side: Days left */}
          <View style={styles.dateInfo}>
            <MaterialIcons name="access-time" size={16} color={colors.mutedText} />
            <Text style={[styles.timeLeft, { color: colors.mutedText }]}>{formatDueDate(task.dueAt ?? undefined)}</Text>
          </View>

          {/* Right side: Due date */}
          <Text style={[styles.dueDate, { color: colors.text }]}>
            Due: {formatDisplayDate(task.dueAt ?? undefined)}
          </Text>
        </View>

        {/* Subtask Progress Circle */}
        {task.subtasks && task.subtasks.length > 0 && (
          <View style={styles.progressContainer}>
            <SubtaskProgress subtasks={task.subtasks} height={7} slantDegrees={-8} showLabel />
          </View>
        )}
      </TouchableOpacity>
      </Animated.View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  taskCard: {
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.11,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
    borderWidth: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  textContent: {
    flex: 1,
    flexShrink: 1,
    paddingRight: 10,
  },
  taskDescription: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  separator: {
    height: 1,
    marginVertical: 10,
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
    marginLeft: 6,
    fontWeight: '500',
  },
  dueDate: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressContainer: {
    marginTop: 12,
    width: '42%',
    alignSelf: 'flex-start',
    paddingTop: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 14,
    marginTop: 2,
    alignSelf: 'flex-start',
    flexShrink: 0,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  priorityHIGH: { backgroundColor: 'rgba(239, 68, 68, 0.14)', borderColor: 'rgba(239, 68, 68, 0.35)' },
  priorityMEDIUM: { backgroundColor: 'rgba(245, 158, 11, 0.14)', borderColor: 'rgba(245, 158, 11, 0.35)' },
  priorityLOW: { backgroundColor: 'rgba(34, 197, 94, 0.14)', borderColor: 'rgba(34, 197, 94, 0.35)' },
  priorityTextHIGH: { color: '#FF4D4D' },
  priorityTextMEDIUM: { color: '#FFB800' },
  priorityTextLOW: { color: '#00C853' },
  priorityURGENT: { backgroundColor: 'rgba(225, 29, 72, 0.16)', borderColor: 'rgba(225, 29, 72, 0.4)' },
  priorityTextURGENT: { color: '#FF1744' },
  rightAction: {
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    width: 116,
    marginBottom: 12,
    marginRight: 16,
  },
  leftAction: {
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    width: 116,
    marginBottom: 12,
    marginLeft: 16,
  },
  actionContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});