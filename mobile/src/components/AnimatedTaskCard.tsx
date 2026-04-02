import React, { useRef } from 'react';
import {
  Animated, TouchableOpacity, View, Text, StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';

type Task = {
  id: string;
  title: string;
  description?: string;
  dueAt?: string;
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
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const tiltAnim = useRef(new Animated.Value(0)).current;

  const isCompleted = task.status === 'COMPLETED';
  const priorityColor = PRIORITY_COLORS[task.priority] ?? colors.mutedText;
  const displayDate = formatDisplayDate?.(task.dueAt) ?? formatDueDate?.(task.dueAt) ?? '';
  const subtasks = task.subtasks ?? [];
  const completedSubs = subtasks.filter((s) => s.status === 'COMPLETED').length;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, friction: 8 }),
      Animated.timing(tiltAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 8 }),
      Animated.timing(tiltAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const tilt = tiltAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '1deg'],
  });

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: isCompleted ? `${colors.success}40` : colors.border,
          transform: [{ scale: scaleAnim }, { rotate: tilt }],
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 4,
        },
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        {/* Completed stripe */}
        {isCompleted && (
          <View style={[styles.completedStripe, { backgroundColor: colors.success }]} />
        )}

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