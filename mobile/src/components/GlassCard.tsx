import React, { ReactNode } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../theme/theme";

type Props = {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
};

export default function GlassCard({ children, style }: Props) {
  return (
    <LinearGradient
      colors={["rgba(255,255,255,0.12)", "rgba(255,255,255,0.04)"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.outer, style]}
    >
      <View style={styles.inner}>{children}</View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: theme.radius.lg,
    padding: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  inner: {
    borderRadius: theme.radius.lg,
    backgroundColor: "rgba(18, 26, 47, 0.88)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
  },
});