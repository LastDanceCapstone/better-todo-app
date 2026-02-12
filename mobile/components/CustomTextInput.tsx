
import React, { useState } from "react";
import { View, Text, TextInput, TextInputProps, Pressable } from "react-native";

type Props = TextInputProps & {
  label?: string;
  helperText?: string;
  errorText?: string;
  rightActionIcon?: React.ReactNode;
  onRightActionPress?: () => void;
};

export default function CustomTextInput({
  label,
  helperText,
  errorText,
  rightActionIcon,
  onRightActionPress,
  style,
  ...inputProps
}: Props) {
  const [focused, setFocused] = useState(false);

  const border = errorText
    ? "#ef4444" // red-500
    : focused
    ? "#6366f1" // indigo-500
    : "#e5e7eb"; // gray-200

  return (
    <View style={{ width: "100%", gap: 6 }}>
      {!!label && (
        <Text style={{ fontSize: 14, color: "#374151", fontWeight: "600" }}>
          {label}
        </Text>
      )}

      <View
        style={{
          borderWidth: 1.5,
          borderColor: border,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#fff",
        }}
      >
        <TextInput
          {...inputProps}
          style={[{ flex: 1, fontSize: 16, color: "#111827" }, style]}
          placeholderTextColor="#9CA3AF"
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
        />

        {rightActionIcon && (
          <Pressable
            onPress={onRightActionPress}
            hitSlop={10}
            style={{ marginLeft: 8 }}
          >
            {rightActionIcon}
          </Pressable>
        )}
      </View>

      {!!errorText ? (
        <Text style={{ color: "#ef4444", fontSize: 12 }}>{errorText}</Text>
      ) : !!helperText ? (
        <Text style={{ color: "#6b7280", fontSize: 12 }}>{helperText}</Text>
      ) : null}
    </View>
  );
}
