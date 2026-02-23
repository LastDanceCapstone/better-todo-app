import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

interface SubtaskProgressProps {
  subtasks?: Array<{ status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' }>;
  height?: number;
  slantDegrees?: number;
  showLabel?: boolean;
}

export default function SubtaskProgress({
  subtasks,
  height = 8,
  slantDegrees = -6,
  showLabel = false,
}: SubtaskProgressProps) {
  if (!subtasks || subtasks.length === 0) {
    return null;
  }

  const totalSubtasks = subtasks.length;
  const completedSubtasks = subtasks.filter((subtask) => subtask.status === 'COMPLETED').length;
  const completionRatio = completedSubtasks / totalSubtasks;
  const completionPercent = Math.round(completionRatio * 100);

  const { colors } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const progressAnim = useRef(new Animated.Value(completionRatio)).current;
  const trackColor = colors.card || '#E5E7EB';
  const fillColor = colors.primary;
  const innerWidth = Math.max(trackWidth, 0);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: completionRatio,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [completionRatio, progressAnim]);

  const animatedWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, innerWidth],
  });

  const label = `${completionPercent}%`;
  const labelSize = Math.max(12, Math.round(height * 1.5));

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.track,
          {
            height,
            borderRadius: height / 2,
            backgroundColor: trackColor,
            transform: [{ skewX: `${slantDegrees}deg` }],
          },
        ]}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      >
        <Animated.View
          style={[
            styles.fill,
            {
              height,
              width: animatedWidth,
              borderRadius: height / 2,
              backgroundColor: fillColor,
            },
          ]}
        />
      </View>
      {showLabel ? (
        <Text style={[styles.label, { color: colors.text, fontSize: labelSize }]}>{label}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  track: {
    flex: 1,
    overflow: 'hidden',
  },
  fill: {
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '600',
  },
});