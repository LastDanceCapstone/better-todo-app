import React, { useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';

interface Confetto {
  id: number;
  left: number;
  delay: number;
  duration: number;
  rotation: number;
}

const generateConfetti = (count: number = 30): Confetto[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 100,
    duration: 2000 + Math.random() * 1000,
    rotation: Math.random() * 360,
  }));
};

const ConfettoPiece = ({ confetto }: { confetto: Confetto }) => {
  const { height } = useWindowDimensions();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: confetto.duration,
      easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
    });
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      progress.value,
      [0, 1],
      [0, height],
      Extrapolate.CLAMP
    );

    const opacity = interpolate(
      progress.value,
      [0, 0.7, 1],
      [1, 1, 0],
      Extrapolate.CLAMP
    );

    const rotate = interpolate(
      progress.value,
      [0, 1],
      [0, confetto.rotation * 2],
      Extrapolate.CLAMP
    );

    return {
      transform: [
        { translateY },
        { rotate: `${rotate}deg` },
        { translateX: Math.sin(progress.value * Math.PI * 4) * 30 },
      ],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: 8,
          height: 8,
          borderRadius: 4,
          left: `${confetto.left}%`,
          top: -10,
          marginLeft: 0,
          backgroundColor: [
            '#DD5789',
            '#ED995A',
            '#2B44E7',
            '#FF6B6B',
            '#4ECDC4',
          ][Math.floor(Math.random() * 5)],
        },
        animatedStyle,
      ]}
    />
  );
};

interface ConfettiProps {
  isVisible: boolean;
  count?: number;
  onComplete?: () => void;
}

export const Confetti = ({
  isVisible,
  count = 30,
  onComplete,
}: ConfettiProps) => {
  const [confetti, setConfetti] = React.useState<Confetto[]>([]);

  useEffect(() => {
    if (isVisible) {
      setConfetti(generateConfetti(count));
      const timer = setTimeout(() => {
        onComplete?.();
      }, 3500);
      return () => clearTimeout(timer);
    }
    setConfetti([]);
  }, [isVisible, count, onComplete]);

  if (!isVisible || confetti.length === 0) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none">
      {confetti.map((c) => (
        <ConfettoPiece key={c.id} confetto={c} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 999,
  },
});