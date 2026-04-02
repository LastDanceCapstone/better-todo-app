import React, { ReactNode, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  ViewStyle,
  PressableProps,
} from "react-native";

type Props = PressableProps & {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
};

export default function AnimatedPressable({
  children,
  style,
  ...props
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      friction: 6,
      tension: 140,
    }).start();
  };

  return (
    <Pressable
      {...props}
      onPressIn={(e) => {
        animateTo(0.96);
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animateTo(1);
        props.onPressOut?.(e);
      }}
    >
      <Animated.View style={[styles.container, style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
});