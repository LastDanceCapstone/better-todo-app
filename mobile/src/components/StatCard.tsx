import React from "react";
import { View, Text, StyleSheet } from "react-native";
import theme from "../theme/theme";

type Props = {
  label: string;
  value: string | number;
};

export default function StatCard({ label, value }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginHorizontal: 4,
  },
  value: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: "800",
  },
  label: {
    color: theme.colors.subtext,
    marginTop: 4,
    fontSize: theme.fontSize.sm,
  },
});