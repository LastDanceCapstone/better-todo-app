import React, { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  StyleProp,
  ViewStyle,
  PressableProps,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SPRING_CONFIG } from './animationTokens';

type Props = PressableProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  pressScale?: number;
};

export default function AnimatedPressable({
  children,
  style,
  disabled = false,
  pressScale = 0.97,
  ...props
}: Props) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const isDisabled = disabled;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Pressable
      {...props}
      disabled={isDisabled}
      onPressIn={(e) => {
        if (!isDisabled) {
          scale.value = withSpring(Math.min(Math.max(pressScale, 0.9), 1), SPRING_CONFIG.press);
          opacity.value = withSpring(0.9, SPRING_CONFIG.press);
        }
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, SPRING_CONFIG.press);
        opacity.value = withSpring(1, SPRING_CONFIG.press);
        props.onPressOut?.(e);
      }}
    >
      <Animated.View
        style={[
          styles.container,
          style,
          animatedStyle,
          isDisabled ? styles.disabled : null,
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  disabled: {
    opacity: 0.55,
  },
});