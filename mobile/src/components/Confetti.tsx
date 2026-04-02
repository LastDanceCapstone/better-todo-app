import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');
const COLORS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF6FCF', '#C77DFF'];
const NUM_PIECES = 30;

type ConfettiPiece = {
  x: Animated.Value;
  y: Animated.Value;
  rotate: Animated.Value;
  opacity: Animated.Value;
  color: string;
  size: number;
};

type Props = {
  visible: boolean;
  onDone?: () => void;
};

export default function Confetti({ visible, onDone }: Props) {
  const pieces = useRef<ConfettiPiece[]>(
    Array.from({ length: NUM_PIECES }, () => ({
      x: new Animated.Value(Math.random() * width),
      y: new Animated.Value(-20),
      rotate: new Animated.Value(0),
      opacity: new Animated.Value(1),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: Math.random() * 10 + 6,
    }))
  ).current;

  useEffect(() => {
    if (!visible) return;

    // Reset all pieces
    pieces.forEach((p) => {
      p.x.setValue(Math.random() * width);
      p.y.setValue(-20);
      p.rotate.setValue(0);
      p.opacity.setValue(1);
    });

    const animations = pieces.map((p) =>
      Animated.parallel([
        Animated.timing(p.y, {
          toValue: height + 20,
          duration: 2000 + Math.random() * 1000,
          useNativeDriver: true,
        }),
        Animated.timing(p.x, {
          toValue: p.x._value + (Math.random() - 0.5) * 200,
          duration: 2000 + Math.random() * 1000,
          useNativeDriver: true,
        }),
        Animated.timing(p.rotate, {
          toValue: Math.random() * 10,
          duration: 2000 + Math.random() * 1000,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(1500),
          Animated.timing(p.opacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    Animated.parallel(animations).start(() => {
      onDone?.();
    });
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => {
        const spin = p.rotate.interpolate({
          inputRange: [0, 10],
          outputRange: ['0deg', '3600deg'],
        });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              borderRadius: Math.random() > 0.5 ? p.size / 2 : 2,
              transform: [
                { translateX: p.x },
                { translateY: p.y },
                { rotate: spin },
              ],
              opacity: p.opacity,
            }}
          />
        );
      })}
    </View>
  );
}