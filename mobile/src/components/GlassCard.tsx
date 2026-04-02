import React, { ReactNode } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { useTheme } from "../theme";

type Props = {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  elevated?: boolean;
};

export default function GlassCard({ children, style, elevated = true }: Props) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.outer,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        elevated ? styles.elevated : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  elevated: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
});