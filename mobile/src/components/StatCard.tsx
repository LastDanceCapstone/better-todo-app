import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "../theme";

type Props = {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  helperText?: string;
  trend?: "up" | "down" | "neutral";
  style?: ViewStyle | ViewStyle[];
};

export default function StatCard({
  label,
  value,
  icon,
  helperText,
  trend = "neutral",
  style,
}: Props) {
  const { colors } = useTheme();

  const trendColor =
    trend === "up" ? colors.success : trend === "down" ? colors.danger : colors.mutedText;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      <View style={styles.headerRow}>
        <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
        {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
      </View>
      <Text style={[styles.label, { color: colors.mutedText }]}>{label}</Text>
      {helperText ? <Text style={[styles.helper, { color: trendColor }]}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginHorizontal: 4,
    minHeight: 96,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconWrap: {
    marginLeft: 8,
  },
  value: {
    fontSize: 24,
    fontWeight: "800",
  },
  label: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "600",
  },
  helper: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "500",
  },
});