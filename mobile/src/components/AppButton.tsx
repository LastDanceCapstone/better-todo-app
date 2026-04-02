import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  StyleProp,
  TextStyle,
  ViewStyle,
} from "react-native";
import { useTheme } from "../theme";
import AnimatedPressable from "./AnimatedPressable";

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export default function AppButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
  leftIcon,
  rightIcon,
  style,
  textStyle,
}: Props) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const variantStyles =
    variant === "secondary"
      ? { backgroundColor: colors.success, borderColor: colors.success, textColor: "#FFFFFF" }
      : variant === "danger"
      ? { backgroundColor: colors.danger, borderColor: colors.danger, textColor: "#FFFFFF" }
      : variant === "ghost"
      ? { backgroundColor: "transparent", borderColor: "transparent", textColor: colors.primary }
      : variant === "outline"
      ? { backgroundColor: "transparent", borderColor: colors.border, textColor: colors.text }
      : { backgroundColor: colors.primary, borderColor: colors.primary, textColor: "#FFFFFF" };

  return (
    <AnimatedPressable
      style={[
        styles.button,
        {
          backgroundColor: variantStyles.backgroundColor,
          borderColor: variantStyles.borderColor,
        },
        isDisabled ? styles.disabled : null,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      pressScale={0.98}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles.textColor} />
      ) : (
        <View style={styles.contentRow}>
          {leftIcon ? <View style={styles.iconWrap}>{leftIcon}</View> : null}
          <Text style={[styles.text, { color: variantStyles.textColor }, textStyle]}>{title}</Text>
          {rightIcon ? <View style={styles.iconWrap}>{rightIcon}</View> : null}
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  disabled: {
    opacity: 0.65,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    marginHorizontal: 6,
  },
  text: {
    fontSize: 16,
    fontWeight: "700",
  },
});