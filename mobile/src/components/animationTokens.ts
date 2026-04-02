import { Easing } from 'react-native-reanimated';

export const ANIMATION_DURATION = {
  fast: 140,
  normal: 220,
  slow: 420,
} as const;

export const ANIMATION_EASING = {
  standard: Easing.out(Easing.cubic),
  smooth: Easing.inOut(Easing.quad),
};

export const SPRING_CONFIG = {
  gentle: {
    damping: 16,
    stiffness: 180,
    mass: 0.7,
  },
  press: {
    damping: 14,
    stiffness: 240,
    mass: 0.5,
  },
};
