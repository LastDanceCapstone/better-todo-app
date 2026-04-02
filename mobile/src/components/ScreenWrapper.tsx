import React from "react";
import { SafeAreaView, StyleSheet, View } from "react-native";
import theme from "../theme/theme";

type Props = {
  children: React.ReactNode;
};

export default function ScreenWrapper({ children }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
});