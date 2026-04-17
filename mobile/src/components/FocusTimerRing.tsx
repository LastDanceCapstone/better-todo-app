import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme';

type Props = {
  size?: number;
  strokeWidth?: number;
  progress: number;
  timeLabel: string;
  isActive: boolean;
  statusLabel?: string;
};

export default function FocusTimerRing({
  size = 234,
  strokeWidth = 14,
  progress,
  timeLabel,
  isActive,
  statusLabel,
}: Props) {
  const { colors } = useTheme();
  const clamped = Math.min(1, Math.max(0, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - clamped);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={isActive ? `${colors.primary}2E` : colors.border}
          strokeWidth={strokeWidth}
          fill="none"
          opacity={isActive ? 0.75 : 0.55}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={isActive ? colors.primary : colors.mutedText}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={-90}
          originX={size / 2}
          originY={size / 2}
          opacity={isActive ? 1 : 0.5}
        />
      </Svg>

      <View style={styles.centerContent}>
        <Text style={[styles.time, { color: colors.text }]}>{timeLabel}</Text>
        <Text style={[styles.state, { color: colors.mutedText }]}>{statusLabel ?? (isActive ? 'In Session' : 'Ready')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  svg: {
    position: 'absolute',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  state: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '600',
  },
});
