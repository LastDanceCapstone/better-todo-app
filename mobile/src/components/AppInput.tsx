import React from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
} from "react-native";
import theme from "../theme/theme";

type Props = TextInputProps & {
  label: string;
};

export default function AppInput({ label, ...props }: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.colors.subtext}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: theme.spacing.md,
  },
  label: {
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    fontSize: theme.fontSize.sm,
    fontWeight: "600",
  },
  input: {
    height: 54,
    backgroundColor: theme.colors.inputBg,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontSize: theme.fontSize.md,
  },
});