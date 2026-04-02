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
      <Ionicons name="notifications-outline" size={26} color={colors.text} />
      {count > 0 && (
        <Animated.View style={[styles.badge, animatedBadgeStyle, { backgroundColor: colors.danger }]}> 
          <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    padding: 6,
  },
  badge: {
    position: "absolute",
    right: 0,
    top: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "800",
  },
});