import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { useThemePreference } from '../theme';

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
  const { currentTheme } = useThemePreference();
  const [trackWidth, setTrackWidth] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const isDark = currentTheme === 'dark';
  const trackColor = isDark ? 'rgba(29, 42, 64, 0.94)' : '#EAF0FA';
  const fillColor = colors.primary;
  const innerWidth = Math.max(trackWidth, 0);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: completionRatio,
      duration: 320,
      useNativeDriver: false,
    }).start();
  }, [completionRatio, progressAnim]);

  const animatedWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, innerWidth],
  });

  const label = `${completionPercent}%`;
  const labelSize = Math.max(11, Math.round(height * 1.45));

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.track,
          {
            height,
            borderRadius: height / 2,
            backgroundColor: trackColor,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: isDark ? 'rgba(122, 140, 170, 0.24)' : 'rgba(0, 74, 173, 0.10)',
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
              shadowColor: fillColor,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.14,
              shadowRadius: 4,
            },
          ]}
        />
      </View>
      {showLabel ? (
        <Text style={[styles.label, { color: colors.mutedText, fontSize: labelSize }]}>{label}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  track: {
    flex: 1,
    overflow: 'hidden',
  },
  fill: {
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.15,
  },
});