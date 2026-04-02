import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView, Edge } from "react-native-safe-area-context";
import { useTheme } from "../theme";

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  keyboardAware?: boolean;
  edges?: Edge[];
  withHorizontalPadding?: boolean;
  contentStyle?: ViewStyle;
  keyboardVerticalOffset?: number;
};

export default function ScreenWrapper({
  children,
  scroll = false,
  keyboardAware = false,
  edges = ["top", "left", "right"],
  withHorizontalPadding = true,
  contentStyle,
  keyboardVerticalOffset = 0,
}: Props) {
  const { colors } = useTheme();

  const content = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            paddingHorizontal: withHorizontalPadding ? 16 : 0,
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </ScrollView>
  ) : (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingHorizontal: withHorizontalPadding ? 16 : 0,
        },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  const wrapped = keyboardAware ? (
    <KeyboardAvoidingView
      style={styles.keyboardWrap}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {content}
    </KeyboardAvoidingView>
  ) : (
    content
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={edges}>
      {wrapped}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  keyboardWrap: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    paddingTop: 16,
  },
});