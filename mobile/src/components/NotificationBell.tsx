import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme/theme";

type Props = {
  count?: number;
};

export default function NotificationBell({ count = 0 }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (count > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.12,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [count, scale]);

  return (
    <View style={styles.wrapper}>
      <Ionicons name="notifications-outline" size={26} color={theme.colors.text} />
      {count > 0 && (
        <Animated.View style={[styles.badge, { transform: [{ scale }] }]}>
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
    backgroundColor: theme.colors.danger,
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