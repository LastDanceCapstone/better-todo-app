import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme';
import { useThemePreference } from '../theme';
import { Swipeable } from 'react-native-gesture-handler';
import { MaterialIcons } from '@expo/vector-icons';
import SubtaskProgress from './SubtaskProgress';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

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

const formatDueDateHelper = (dueAt?: string) => {
  if (!dueAt) {
    return 'No due date';
  }

  const date = new Date(dueAt);
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return 'Overdue';
  }
  if (diffDays === 0) {
    return 'Due today';
  }
  if (diffDays === 1) {
    return 'Due tomorrow';
  }
  return `${diffDays} days left`;
};

const isCompletedLate = (task: Task) => {
  if (task.status !== 'COMPLETED' || !task.dueAt || !task.completedAt) {
    return false;
  }

  return new Date(task.completedAt).getTime() > new Date(task.dueAt).getTime();
};

const getPriorityPalette = (priority: Task['priority']) => {
  switch (priority) {
    case 'URGENT':
      return {
        backgroundColor: 'rgba(185, 28, 28, 0.11)',
        borderColor: 'rgba(185, 28, 28, 0.18)',
        textColor: '#B91C1C',
      };
    case 'HIGH':
      return {
        backgroundColor: 'rgba(234, 88, 12, 0.11)',
        borderColor: 'rgba(234, 88, 12, 0.18)',
        textColor: '#C2410C',
      };
    case 'MEDIUM':
      return {
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderColor: 'rgba(245, 158, 11, 0.18)',
        textColor: '#B45309',
      };
    case 'LOW':
    default:
      return {
        backgroundColor: 'rgba(34, 197, 94, 0.11)',
        borderColor: 'rgba(34, 197, 94, 0.18)',
        textColor: '#15803D',
      };
  }
};

const getStatusAppearance = (task: Task, colors: ReturnType<typeof useTheme>['colors']) => {
  if (task.status === 'COMPLETED') {
    if (isCompletedLate(task)) {
      return {
        icon: 'history-toggle-off' as const,
        label: 'Completed late',
        textColor: '#738A2B',
        backgroundColor: 'rgba(139, 153, 42, 0.12)',
        borderColor: 'rgba(139, 153, 42, 0.18)',
        iconBackground: 'rgba(139, 153, 42, 0.16)',
      };
    }

    return {
      icon: 'task-alt' as const,
      label: 'Completed',
      textColor: colors.success,
      backgroundColor: `${colors.success}14`,
      borderColor: `${colors.success}24`,
      iconBackground: `${colors.success}1F`,
    };
  }

  const dueAt = task.dueAt ? new Date(task.dueAt) : null;
  const now = new Date();

  if (dueAt && dueAt.getTime() < now.getTime()) {
    return {
      icon: 'warning-amber' as const,
      label: 'Overdue',
      textColor: '#C9772B',
      backgroundColor: 'rgba(201, 119, 43, 0.12)',
      borderColor: 'rgba(201, 119, 43, 0.18)',
      iconBackground: 'rgba(201, 119, 43, 0.16)',
    };
  }

  const diffDays = dueAt ? Math.ceil((dueAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
  if (diffDays === 0) {
    return {
      icon: 'event-available' as const,
      label: 'Due today',
      textColor: colors.primary,
      backgroundColor: `${colors.primary}12`,
      borderColor: `${colors.primary}20`,
      iconBackground: `${colors.primary}1A`,
    };
  }

  return {
    icon: 'schedule' as const,
    label: formatDueDateHelper(task.dueAt ?? undefined),
    textColor: colors.mutedText,
    backgroundColor: 'rgba(148, 163, 184, 0.10)',
    borderColor: 'rgba(148, 163, 184, 0.16)',
    iconBackground: 'rgba(148, 163, 184, 0.14)',
  };
};

const getCardGradient = (task: Task, isDark: boolean): readonly [string, string] => {
  if (task.status === 'COMPLETED') {
    return isDark ? ['#102117', '#0E1A13'] : ['#FBFEFC', '#F4FBF7'];
  }

  if (task.priority === 'URGENT' || task.priority === 'HIGH') {
    return isDark ? ['#161E2D', '#101724'] : ['#FFFFFF', '#F7FAFF'];
  }

  return isDark ? ['#121C2E', '#0D1523'] : ['#FFFFFF', '#F8FBFF'];
};

export default function SwipeableTaskCard({
  task,
  onPress,
  onStatusChange,
  formatDueDate,
  formatDisplayDate,
  isTransitioning = false,
}: SwipeableTaskCardProps) {
  const { colors } = useTheme();
  const { currentTheme } = useThemePreference();
  const swipeableRef = useRef<Swipeable>(null);
  const swipeActive = useRef(new Animated.Value(0)).current;
  const pressValue = useRef(new Animated.Value(0)).current;
  const transitionValue = useRef(new Animated.Value(isTransitioning ? 1 : 0)).current;

  const pressScale = pressValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.982],
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
  const isDark = currentTheme === 'dark';
  const priorityPalette = getPriorityPalette(task.priority);
  const statusAppearance = getStatusAppearance(task, colors);
  const cardGradient = getCardGradient(task, isDark);
  const cardBorderColor =
    task.status === 'COMPLETED'
      ? `${colors.success}18`
      : isDark
        ? 'rgba(93, 113, 145, 0.22)'
        : 'rgba(0, 74, 173, 0.08)';

  const getStatusSummary = () => {
    if (task.status !== 'COMPLETED') {
      return formatDueDate(task.dueAt ?? undefined);
    }

    const dueAt = task.dueAt ? new Date(task.dueAt) : null;
    const completedAt = task.completedAt ? new Date(task.completedAt) : null;

    if (dueAt && completedAt && completedAt.getTime() > dueAt.getTime()) {
      return 'Completed late';
    }

    return 'Completed';
  };

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
          styles.taskCardShell,
          {
            transform: [{ scale: combinedScale }],
            shadowColor: isDark ? '#020617' : '#8EADE0',
            shadowOpacity: swipeActive.interpolate({
              inputRange: [0, 1],
              outputRange: [0.1, 0.16],
            }),
            shadowRadius: swipeActive.interpolate({
              inputRange: [0, 1],
              outputRange: [12, 15],
            }),
            elevation: swipeActive.interpolate({
              inputRange: [0, 1],
              outputRange: [4, 6],
            }),
          },
        ]}
      >
      <TouchableOpacity
        style={styles.pressable}
        onPress={() => {
          void Haptics.selectionAsync().catch(() => undefined);
          onPress();
        }}
        activeOpacity={1}
        onPressIn={() => {
          Animated.timing(pressValue, {
            toValue: 1,
            duration: 90,
            useNativeDriver: true,
          }).start();
        }}
        onPressOut={() => {
          Animated.spring(pressValue, {
            toValue: 0,
            tension: 200,
            friction: 17,
            useNativeDriver: true,
          }).start();
        }}
      >
        <LinearGradient colors={cardGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.taskCard, { borderColor: cardBorderColor }]}> 
        {/* Task Header */}
        <View style={styles.headerRow}>
          <View style={styles.textContent}>
            <Text style={[styles.taskTitle, { color: colors.text }]}>{task.title}</Text>
            <Text numberOfLines={2} ellipsizeMode="tail" style={[styles.taskDescription, { color: colors.mutedText }]}> 
              {task.description || 'No description'}
            </Text>
          </View>

          {/* Priority Tag */}
          {task.priority && (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: priorityPalette.backgroundColor,
                  borderColor: priorityPalette.borderColor,
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: priorityPalette.textColor }]}> 
                {task.priority}
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.separator, { backgroundColor: isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(0, 74, 173, 0.08)' }]} />

        <View style={styles.taskFooter}>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: statusAppearance.backgroundColor,
                borderColor: statusAppearance.borderColor,
              },
            ]}
          >
            <View style={[styles.statusIconWrap, { backgroundColor: statusAppearance.iconBackground }]}>
              <MaterialIcons name={statusAppearance.icon} size={13} color={statusAppearance.textColor} />
            </View>
            <Text style={[styles.timeLeft, { color: statusAppearance.textColor }]}> 
              {statusAppearance.label}
            </Text>
          </View>

          {/* Right side: Due date */}
          {task.status === 'COMPLETED' && task.completedAt ? (
            <Text style={[styles.dueDate, { color: colors.text }]}> 
              Completed: {formatDisplayDate(task.completedAt ?? undefined)}
            </Text>
          ) : (
            <Text style={[styles.dueDate, { color: colors.text }]}> 
              Due: {formatDisplayDate(task.dueAt ?? undefined)}
            </Text>
          )}
        </View>

        {/* Subtask Progress Circle */}
        {task.subtasks && task.subtasks.length > 0 && (
          <View style={styles.progressContainer}>
            <SubtaskProgress subtasks={task.subtasks} height={8} slantDegrees={0} showLabel />
          </View>
        )}
        </LinearGradient>
      </TouchableOpacity>
      </Animated.View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  taskCardShell: {
    marginHorizontal: 16,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 7 },
    position: 'relative',
  },
  pressable: {
    borderRadius: 20,
  },
  taskCard: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 15,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
    lineHeight: 21,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  textContent: {
    flex: 1,
    flexShrink: 1,
    paddingRight: 9,
  },
  taskDescription: {
    fontSize: 13,
    marginTop: 0,
    lineHeight: 17,
  },
  separator: {
    height: 1,
    marginVertical: 11,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingLeft: 5,
    paddingRight: 9,
    paddingVertical: 4,
    gap: 5,
  },
  statusIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeLeft: {
    fontSize: 11,
    fontWeight: '600',
  },
  dueDate: {
    fontSize: 11,
    fontWeight: '600',
    maxWidth: '54%',
    textAlign: 'right',
    lineHeight: 15,
  },
  progressContainer: {
    marginTop: 6,
    width: '48%',
    alignSelf: 'flex-start',
    paddingTop: 0,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 1,
    alignSelf: 'flex-start',
    flexShrink: 0,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
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