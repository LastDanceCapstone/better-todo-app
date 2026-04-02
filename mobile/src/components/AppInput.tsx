import React from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  StyleProp,
  TextStyle,
  ViewStyle,
} from "react-native";
import { useTheme } from "../theme";

type Props = TextInputProps & {
  label: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

export default function AppInput({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  containerStyle,
  inputStyle,
  labelStyle,
  ...props
}: Props) {
  const { colors } = useTheme();
  const hasError = typeof error === "string" && error.length > 0;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      <Text style={[styles.label, { color: colors.mutedText }, labelStyle]}>{label}</Text>
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: colors.surface,
            borderColor: hasError ? colors.danger : colors.border,
          },
        ]}
      >
        {leftIcon ? <View style={styles.leadingIcon}>{leftIcon}</View> : null}
        <TextInput
          placeholderTextColor={colors.mutedText}
          style={[
            styles.input,
            {
              color: colors.text,
              paddingLeft: leftIcon ? 4 : 14,
              paddingRight: rightIcon ? 6 : 14,
            },
            inputStyle,
          ]}
          accessibilityLabel={label}
          {...props}
        />
        {rightIcon ? <View style={styles.trailingIcon}>{rightIcon}</View> : null}
      </View>
      {hasError ? <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text> : null}
      {!hasError && helperText ? (
        <Text style={[styles.helperText, { color: colors.mutedText }]}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "600",
  },
  inputRow: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    height: 54,
    flex: 1,
    fontSize: 15,
  },
  leadingIcon: {
    paddingLeft: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  trailingIcon: {
    paddingRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  helperText: {
    marginTop: 6,
    fontSize: 12,
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "600",
  },
});