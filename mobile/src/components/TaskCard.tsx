import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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

type Subtask = {
  id: string;
  title: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
};

type Task = {
  id: string;
  title: string;
  description?: string;
  dueAt?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  subtasks?: Subtask[];
};

type Props = {
  task?: Task;
  onPress?: () => void;
  onStatusChange?: (id: string, status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED') => void;
  formatDueDate?: (date?: string) => string;
  formatDisplayDate?: (date?: string) => string;
  title?: string;
  category?: string;
  completed?: boolean;
  onDelete?: () => void;
};

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: '#FF4D4D', HIGH: '#FF8C00', MEDIUM: '#F59E0B', LOW: '#22C55E',
};

export default function TaskCard({ task, onPress, onStatusChange, formatDueDate, formatDisplayDate, title: legacyTitle, category, completed: legacyCompleted, onDelete }: Props) {
  const { colors } = useTheme();

  const pressScale = useSharedValue(1);
  const completionPulse = useSharedValue(1);

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value * completionPulse.value }],
  }));

  const isTaskCompleted = task?.status === 'COMPLETED';
  const prevCompleted = useRef(isTaskCompleted);

  useEffect(() => {
    if (!task) return;
    if (!prevCompleted.current && isTaskCompleted) {
      completionPulse.value = withSequence(
        withSpring(1.025, SPRING_CONFIG.gentle),
        withTiming(1, { duration: ANIMATION_DURATION.fast, easing: ANIMATION_EASING.standard })
      );
    }
    prevCompleted.current = !!isTaskCompleted;
  }, [task, isTaskCompleted, completionPulse]);

  if (!task) {
    return (
      <Animated.View
        entering={FadeInUp.duration(ANIMATION_DURATION.normal).easing(ANIMATION_EASING.standard)}
        style={[styles.legacyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={styles.legacyLeft}>
          <View style={[styles.dot, { backgroundColor: legacyCompleted ? colors.success : colors.primary }]} />
          <View>
            <Text style={[styles.legacyTitle, { color: colors.text }]}>{legacyTitle}</Text>
            {category ? <Text style={[styles.legacyCategory, { color: colors.mutedText }]}>{category}</Text> : null}
          </View>
        </View>
        {onDelete ? (
          <TouchableOpacity onPress={onDelete} style={[styles.deleteBtn, { backgroundColor: `${colors.danger}18` }]}>
            <Text style={[styles.deleteText, { color: colors.danger }]}>Delete</Text>
          </TouchableOpacity>
        ) : null}
      </Animated.View>
    );
  }

  const isCompleted = task.status === 'COMPLETED';
  const priorityColor = PRIORITY_COLORS[task.priority] ?? colors.mutedText;
  const displayDate = formatDisplayDate?.(task.dueAt) ?? formatDueDate?.(task.dueAt) ?? '';
  const subtasks = task.subtasks ?? [];
  const completedSubs = subtasks.filter((s) => s.status === 'COMPLETED').length;

  return (
    <Animated.View
      entering={FadeInUp.duration(ANIMATION_DURATION.normal).easing(ANIMATION_EASING.standard)}
    >
    <Animated.View style={animatedCardStyle}>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={onPress}
        activeOpacity={1}
        onPressIn={() => {
          pressScale.value = withSpring(0.985, SPRING_CONFIG.press);
        }}
        onPressOut={() => {
          pressScale.value = withSpring(1, SPRING_CONFIG.press);
        }}
      >
      <View style={styles.topRow}>
        <TouchableOpacity onPress={() => onStatusChange?.(task.id, isCompleted ? 'TODO' : 'COMPLETED')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name={isCompleted ? 'check-circle' : 'radio-button-unchecked'} size={22} color={isCompleted ? colors.success : colors.mutedText} />
        </TouchableOpacity>
        <Text numberOfLines={2} style={[styles.title, { color: colors.text }, isCompleted && { textDecorationLine: 'line-through', color: colors.mutedText }]}>
          {task.title}
        </Text>
        <View style={[styles.priorityBadge, { backgroundColor: `${priorityColor}20` }]}>
          <Text style={[styles.priorityText, { color: priorityColor }]}>
            {task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}
          </Text>
        </View>
      </View>

      {task.description ? <Text numberOfLines={1} style={[styles.description, { color: colors.mutedText }]}>{task.description}</Text> : null}

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
            <Text style={[styles.metaText, { color: colors.mutedText }]}>{completedSubs}/{subtasks.length}</Text>
          </View>
        ) : null}
        <View style={[styles.statusPill, { backgroundColor: isCompleted ? `${colors.success}18` : `${colors.primary}18` }]}>
          <Text style={[styles.statusText, { color: isCompleted ? colors.success : colors.primary }]}>
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
  card: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, marginHorizontal: 16, marginBottom: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  title: { flex: 1, fontSize: 15, fontWeight: '600' },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  priorityText: { fontSize: 11, fontWeight: '700' },
  description: { fontSize: 13, marginBottom: 8, marginLeft: 32 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 32, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 12 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginLeft: 'auto' },
  statusText: { fontSize: 11, fontWeight: '700' },
  legacyCard: { borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  legacyLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  legacyTitle: { fontSize: 15, fontWeight: '700' },
  legacyCategory: { fontSize: 12, marginTop: 2 },
  deleteBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  deleteText: { fontWeight: '700', fontSize: 13 },
});