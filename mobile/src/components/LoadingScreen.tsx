import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../theme/theme";

export default function LoadingScreen() {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.05,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.92,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [spin, pulse]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ rotate }, { scale: pulse }] }}>
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.primary2]}
          style={styles.loader}
        />
      </Animated.View>
      <Text style={styles.text}>Loading your productivity universe...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  loader: {
    width: 70,
    height: 70,
    borderRadius: 35,
    opacity: 0.95,
  },
  text: {
    marginTop: 18,
    color: theme.colors.subtext,
    fontSize: 15,
    fontWeight: "600",
  },
});