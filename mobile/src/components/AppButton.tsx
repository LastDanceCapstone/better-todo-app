import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import theme from "../theme/theme";

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger";
};

export default function AppButton({
  title,
  onPress,
  loading = false,
  variant = "primary",
}: Props) {
  const buttonStyle =
    variant === "secondary"
      ? styles.secondary
      : variant === "danger"
      ? styles.danger
      : styles.primary;

  return (
    <TouchableOpacity
      style={[styles.button, buttonStyle]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.white} />
      ) : (
        <Text style={styles.text}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 54,
    borderRadius: theme.radius.lg,
    justifyContent: "center",
    alignItems: "center",
    marginTop: theme.spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  primary: {
    backgroundColor: theme.colors.primary,
  },
  secondary: {
    backgroundColor: theme.colors.secondary,
  },
  danger: {
    backgroundColor: theme.colors.danger,
  },
  text: {
    color: theme.colors.white,
    fontSize: theme.fontSize.md,
    fontWeight: "700",
  },
});