import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme';
import { ANIMATION_DURATION, ANIMATION_EASING } from './animationTokens';

export default function LoadingScreen() {
  const { colors } = useTheme();
  const rotate = useSharedValue(0);
  const pulse = useSharedValue(0.96);

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotate.value}deg` },
      { scale: pulse.value },
    ],
  }));

  useEffect(() => {
    rotate.value = withRepeat(
      withTiming(360, {
        duration: ANIMATION_DURATION.slow * 4,
        easing: Easing.linear,
      }),
      -1,
      false
    );

    pulse.value = withRepeat(
      withTiming(1.04, {
        duration: ANIMATION_DURATION.slow,
        easing: ANIMATION_EASING.smooth,
      }),
      -1,
      true
    );
  }, [rotate, pulse]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <Animated.View style={[styles.loader, { borderColor: colors.border, borderTopColor: colors.primary }, spinnerStyle]} />
      <View style={[styles.dot, { backgroundColor: colors.primary }]} />
      <Text style={[styles.text, { color: colors.mutedText }]}>Loading your productivity universe...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loader: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 14,
    opacity: 0.9,
  },
  text: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: "600",
  },
});