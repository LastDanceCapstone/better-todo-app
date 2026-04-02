import React, { useEffect, useRef } from 'react';
import {
  TouchableOpacity, View, Text, StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme';
import { ANIMATION_DURATION, ANIMATION_EASING, SPRING_CONFIG } from './animationTokens';

type Task = {
  id: string;
  title: string;
  description?: string | null;
  dueAt?: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  subtasks?: any[];
};

type Props = {
  task: Task;
  onPress?: () => void;
  onStatusChange?: (id: string, status: any) => void;
  onDelete?: (id: string) => void;
  formatDueDate?: (date?: string) => string;
  formatDisplayDate?: (date?: string) => string;
};

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: '#FF4D4D', HIGH: '#FF8C00', MEDIUM: '#F59E0B', LOW: '#22C55E',
};

export default function AnimatedTaskCard({
  task, onPress, onStatusChange, onDelete, formatDueDate, formatDisplayDate,
}: Props) {
  const { colors } = useTheme();
  const prevCompleted = useRef(task.status === 'COMPLETED');
  const pressScale = useSharedValue(1);
  const pressRotate = useSharedValue(0);
  const completePulse = useSharedValue(1);
  const stripeProgress = useSharedValue(task.status === 'COMPLETED' ? 1 : 0);

  const isCompleted = task.status === 'COMPLETED';
  const priorityColor = PRIORITY_COLORS[task.priority] ?? colors.mutedText;
  const dueAtValue = task.dueAt ?? undefined;
  const displayDate = formatDisplayDate?.(dueAtValue) ?? formatDueDate?.(dueAtValue) ?? '';
  const subtasks = task.subtasks ?? [];
  const completedSubs = subtasks.filter((s) => s.status === 'COMPLETED').length;

  useEffect(() => {
    const wasCompleted = prevCompleted.current;
    if (!wasCompleted && isCompleted) {
      completePulse.value = withSequence(
        withSpring(1.03, SPRING_CONFIG.gentle),
        withTiming(1, { duration: ANIMATION_DURATION.fast, easing: ANIMATION_EASING.standard })
      );
      stripeProgress.value = withTiming(1, {
        duration: ANIMATION_DURATION.normal,
        easing: ANIMATION_EASING.standard,
      });
    } else if (wasCompleted && !isCompleted) {
      stripeProgress.value = withTiming(0, {
        duration: ANIMATION_DURATION.fast,
        easing: ANIMATION_EASING.standard,
      });
    }
    prevCompleted.current = isCompleted;
  }, [isCompleted, completePulse, stripeProgress]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: pressScale.value * completePulse.value },
      { rotateZ: `${pressRotate.value}deg` },
    ],
  }));

  const completedStripeStyle = useAnimatedStyle(() => ({
    opacity: stripeProgress.value,
    transform: [{ scaleX: stripeProgress.value }],
  }));

  const handlePressIn = () => {
    pressScale.value = withSpring(0.98, SPRING_CONFIG.press);
    pressRotate.value = withTiming(0.45, {
      duration: ANIMATION_DURATION.fast,
      easing: ANIMATION_EASING.standard,
    });
  };

  const handlePressOut = () => {
    pressScale.value = withSpring(1, SPRING_CONFIG.press);
    pressRotate.value = withTiming(0, {
      duration: ANIMATION_DURATION.fast,
      easing: ANIMATION_EASING.standard,
    });
  };

  return (
    <Animated.View
      entering={FadeInUp.duration(ANIMATION_DURATION.normal).easing(ANIMATION_EASING.standard)}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: isCompleted ? `${colors.success}40` : colors.border,
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 4,
        },
      ]}
    >
      <Animated.View style={cardAnimatedStyle}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        {/* Completed stripe */}
        <Animated.View style={[styles.completedStripe, { backgroundColor: colors.success }, completedStripeStyle]} />

        {/* Top row */}
        <View style={styles.topRow}>
          <TouchableOpacity
            onPress={() => onStatusChange?.(task.id, isCompleted ? 'TODO' : 'COMPLETED')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Animated.View>
              <MaterialIcons
                name={isCompleted ? 'check-circle' : 'radio-button-unchecked'}
                size={24}
                color={isCompleted ? colors.success : colors.mutedText}
              />
            </Animated.View>
          </TouchableOpacity>

          <Text
            numberOfLines={2}
            style={[
              styles.title,
              { color: colors.text },
              isCompleted && { textDecorationLine: 'line-through', color: colors.mutedText },
            ]}
          >
            {task.title}
          </Text>

          <View style={[styles.priorityBadge, { backgroundColor: `${priorityColor}20` }]}>
            <Text style={[styles.priorityText, { color: priorityColor }]}>
              {task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => onDelete?.(task.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons name="delete-outline" size={20} color={colors.danger} />
          </TouchableOpacity>
        </View>

        {/* Description */}
        {task.description ? (
          <Text numberOfLines={1} style={[styles.description, { color: colors.mutedText }]}>
            {task.description}
          </Text>
        ) : null}

        {/* Bottom row */}
        <View style={styles.bottomRow}>
          {task.dueAt ? (
            <View style={styles.metaItem}>
              <MaterialIcons name="event" size={13} color={colors.mutedText} />
              <Text style={[styles.metaText, { color: colors.mutedText }]}>{displayDate}</Text>
            </View>
          ) : null}

          {subtasks.length > 0 ? (
            <View style={styles.metaItem}>
              <MaterialIcons name="checklist" size={13} color={colors.mutedText} />
              <Text style={[styles.metaText, { color: colors.mutedText }]}>
                {completedSubs}/{subtasks.length}
              </Text>
            </View>
          ) : null}

          <View style={[styles.statusPill, {
            backgroundColor: isCompleted ? `${colors.success}18` : `${colors.primary}18`,
          }]}>
            <Text style={[styles.statusText, {
              color: isCompleted ? colors.success : colors.primary,
            }]}>
              {task.status.replace('_', ' ')}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 10,
    overflow: 'hidden',
  },
  completedStripe: {
    height: 3,
    width: '100%',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    marginBottom: 4,
  },
  title: { flex: 1, fontSize: 15, fontWeight: '600' },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  priorityText: { fontSize: 11, fontWeight: '700' },
  description: { fontSize: 13, marginBottom: 8, marginLeft: 48, paddingHorizontal: 14 },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 48,
    paddingHorizontal: 14,
    paddingBottom: 12,
    flexWrap: 'wrap',
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 12 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginLeft: 'auto' },
  statusText: { fontSize: 11, fontWeight: '700' },
});