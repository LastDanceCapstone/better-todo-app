import React, { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from "../theme";
import { SPRING_CONFIG } from './animationTokens';

type Props = {
  count?: number;
};

export default function NotificationBell({ count = 0 }: Props) {
  const { colors } = useTheme();
  const previousCount = useRef(count);
  const scale = useSharedValue(1);
  const iconColor = count > 0 ? colors.primary : colors.text;
  const displayCount = count > 99 ? '99+' : `${Math.max(0, count)}`;
  const isSingleDigit = count > 0 && count < 10;
  const isLargeDisplay = displayCount.length >= 3;

  const animatedBadgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    const had = previousCount.current;
    if (count > had && count > 0) {
      scale.value = withSequence(
        withSpring(1.16, SPRING_CONFIG.gentle),
        withSpring(1, SPRING_CONFIG.gentle)
      );
    }
    previousCount.current = count;
  }, [count, scale]);

  return (
    <View style={styles.wrapper}>
      <Ionicons name={count > 0 ? 'notifications' : 'notifications-outline'} size={24} color={iconColor} />
      {count > 0 && (
        <Animated.View
          style={[
            styles.badge,
            isSingleDigit
              ? styles.badgeSingleDigit
              : isLargeDisplay
                ? styles.badgeLarge
                : styles.badgeDoubleDigit,
            animatedBadgeStyle,
            { backgroundColor: colors.danger, borderColor: colors.surface },
          ]}
        >
          <Text style={[styles.badgeText, isLargeDisplay ? styles.badgeTextLarge : styles.badgeTextNormal]}>{displayCount}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: "absolute",
    right: -7,
    top: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 0,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  badgeSingleDigit: {
    minWidth: 20,
    paddingHorizontal: 0,
  },
  badgeDoubleDigit: {
    minWidth: 24,
    paddingHorizontal: 5,
  },
  badgeLarge: {
    minWidth: 29,
    paddingHorizontal: 6,
  },
  badgeText: {
    color: "white",
    fontWeight: "800",
    textAlign: 'center',
    includeFontPadding: false,
  },
  badgeTextNormal: {
    fontSize: 10,
    lineHeight: 12,
  },
  badgeTextLarge: {
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0.2,
  },
});