import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface SubtaskProgressProps {
  subtasks?: Array<{ isCompleted: boolean }>;
  size?: number;
  strokeWidth?: number;
}

export default function SubtaskProgress({ 
  subtasks, 
  size = 50, 
  strokeWidth = 4 
}: SubtaskProgressProps) {
  // Don't render if no subtasks
  if (!subtasks || subtasks.length === 0) {
    return null;
  }

  const totalSubtasks = subtasks.length;
  const completedSubtasks = subtasks.filter(s => s.isCompleted).length;
  const completionRatio = completedSubtasks / totalSubtasks;
  const completionPercent = Math.round(completionRatio * 100);

  // Circle calculations
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (completionRatio * circumference);

  // Color based on completion
  const getProgressColor = () => {
    if (completionPercent === 100) return '#00C853'; // Green
    if (completionPercent >= 50) return '#FFB800'; // Orange
    return '#4E8FFF'; // Blue
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.svg}>
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E5E5E5"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getProgressColor()}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {/* Center text */}
      <View style={styles.textContainer}>
        <Text style={[styles.percentText, { color: getProgressColor() }]}>
          {completionPercent}%
        </Text>
        <Text style={styles.fractionText}>
          {completedSubtasks}/{totalSubtasks}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  svg: {
    position: 'absolute',
  },
  textContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentText: {
    fontSize: 12,
    fontWeight: '700',
  },
  fractionText: {
    fontSize: 8,
    color: '#666666',
    marginTop: -2,
  },
});