import React, { useEffect, useRef, useState } from 'react';
import { Animated, TouchableOpacity, StyleSheet, View, Text } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

type MascotMood = 'idle' | 'happy' | 'giggle' | 'celebrate';

type Props = {
  mood?: MascotMood;
  size?: number;
};

export default function Mascot({ mood = 'idle', size = 100 }: Props) {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const eyeBlinkAnim = useRef(new Animated.Value(1)).current;
  const [isGiggling, setIsGiggling] = useState(false);
  const [showGiggleText, setShowGiggleText] = useState(false);

  // Idle bounce
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -6, duration: 900, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Random blink
  useEffect(() => {
    const blinkLoop = () => {
      const delay = 2500 + Math.random() * 2500;
      setTimeout(() => {
        Animated.sequence([
          Animated.timing(eyeBlinkAnim, { toValue: 0.05, duration: 80, useNativeDriver: true }),
          Animated.timing(eyeBlinkAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
        ]).start(blinkLoop);
      }, delay);
    };
    blinkLoop();
  }, []);

  // Mood reactions
  useEffect(() => {
    if (mood === 'happy' || mood === 'celebrate') {
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.2, useNativeDriver: true, friction: 4 }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 6 }),
      ]).start();
    }
    if (mood === 'celebrate') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(rotateAnim, { toValue: 0.8, duration: 250, useNativeDriver: true }),
          Animated.timing(rotateAnim, { toValue: -0.8, duration: 250, useNativeDriver: true }),
          Animated.timing(rotateAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]),
        { iterations: 4 }
      ).start();
    }
  }, [mood]);

  const handleGiggle = () => {
    if (isGiggling) return;
    setIsGiggling(true);
    setShowGiggleText(true);

    Animated.sequence([
      Animated.timing(rotateAnim, { toValue: 0.08, duration: 55, useNativeDriver: true }),
      Animated.timing(rotateAnim, { toValue: -0.08, duration: 55, useNativeDriver: true }),
      Animated.timing(rotateAnim, { toValue: 0.08, duration: 55, useNativeDriver: true }),
      Animated.timing(rotateAnim, { toValue: -0.08, duration: 55, useNativeDriver: true }),
      Animated.timing(rotateAnim, { toValue: 0.05, duration: 55, useNativeDriver: true }),
      Animated.timing(rotateAnim, { toValue: -0.05, duration: 55, useNativeDriver: true }),
      Animated.timing(rotateAnim, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start(() => {
      setIsGiggling(false);
      setTimeout(() => setShowGiggleText(false), 600);
    });

    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.2, useNativeDriver: true, friction: 4 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 6 }),
    ]).start();

    Animated.sequence([
      Animated.timing(eyeBlinkAnim, { toValue: 0.05, duration: 60, useNativeDriver: true }),
      Animated.timing(eyeBlinkAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(eyeBlinkAnim, { toValue: 0.05, duration: 60, useNativeDriver: true }),
      Animated.timing(eyeBlinkAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const spin = rotateAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-30deg', '30deg'],
  });

  const isHappy = mood === 'happy' || mood === 'celebrate';

  // SVG viewBox is 120x160
  const svgW = size;
  const svgH = size * 1.35;

  return (
    <TouchableOpacity onPress={handleGiggle} activeOpacity={1} style={styles.wrapper}>
      <Animated.View
        style={{
          transform: [
            { translateY: bounceAnim },
            { scale: scaleAnim },
            { rotate: spin },
          ],
          alignItems: 'center',
        }}
      >
        <Svg width={svgW} height={svgH} viewBox="0 0 120 162">

          {/* Shadow */}
          <Ellipse cx="60" cy="158" rx="26" ry="4" fill="rgba(0,0,0,0.12)" />

          {/* Body / Shirt */}
          <Rect x="26" y="104" width="68" height="44" rx="14" fill="#3B82F6" />

          {/* Shirt collar white */}
          <Path d="M48 104 L60 120 L72 104" fill="white" />

          {/* Neck */}
          <Rect x="50" y="94" width="20" height="16" rx="5" fill="#FBBF7A" />

          {/* Head */}
          <Ellipse cx="60" cy="68" rx="36" ry="38" fill="#FBBF7A" />

          {/* Hair top */}
          <Path
            d="M24 62 Q28 24 60 22 Q92 24 96 62 Q88 44 60 42 Q32 44 24 62Z"
            fill="#3D2B1F"
          />
          {/* Left side hair */}
          <Ellipse cx="24" cy="67" rx="7" ry="12" fill="#3D2B1F" />
          {/* Right side hair */}
          <Ellipse cx="96" cy="67" rx="7" ry="12" fill="#3D2B1F" />

          {/* Left ear */}
          <Ellipse cx="24" cy="72" rx="7" ry="9" fill="#F5A55A" />
          <Ellipse cx="23" cy="72" rx="4" ry="6" fill="#E8855A" />

          {/* Right ear */}
          <Ellipse cx="96" cy="72" rx="7" ry="9" fill="#F5A55A" />
          <Ellipse cx="97" cy="72" rx="4" ry="6" fill="#E8855A" />

          {/* Left eyebrow */}
          <Path
            d={isHappy ? 'M36 52 Q44 47 52 51' : 'M36 54 Q44 49 52 53'}
            stroke="#3D2B1F"
            strokeWidth="2.8"
            strokeLinecap="round"
            fill="none"
          />
          {/* Right eyebrow */}
          <Path
            d={isHappy ? 'M68 51 Q76 47 84 52' : 'M68 53 Q76 49 84 54'}
            stroke="#3D2B1F"
            strokeWidth="2.8"
            strokeLinecap="round"
            fill="none"
          />

          {/* ── LEFT EYE ── */}
          {/* White */}
          <Ellipse cx="44" cy="66" rx="9" ry="10" fill="white" />
          {/* Iris */}
          <Ellipse
            cx="44"
            cy="67"
            rx="5.5"
            ry={isHappy ? 3.5 : 6}
            fill="#1E40AF"
          />
          {/* Pupil */}
          <Circle cx="44" cy={isHappy ? 66 : 66} r="2.8" fill="#0F172A" />
          {/* Shine */}
          <Circle cx="42" cy="64" r="1.3" fill="white" />
          {/* Eyelid blink overlay — scaleY animates to close eye */}
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              transform: [{ scaleY: eyeBlinkAnim }],
            }}
          />

          {/* ── RIGHT EYE ── */}
          {/* White */}
          <Ellipse cx="76" cy="66" rx="9" ry="10" fill="white" />
          {/* Iris */}
          <Ellipse
            cx="76"
            cy="67"
            rx="5.5"
            ry={isHappy ? 3.5 : 6}
            fill="#1E40AF"
          />
          {/* Pupil */}
          <Circle cx="76" cy="66" r="2.8" fill="#0F172A" />
          {/* Shine */}
          <Circle cx="74" cy="64" r="1.3" fill="white" />

          {/* Happy eye sparkles */}
          {isHappy && (
            <>
              <Circle cx="47" cy="62" r="2" fill="white" opacity="0.95" />
              <Circle cx="79" cy="62" r="2" fill="white" opacity="0.95" />
            </>
          )}

          {/* Nose */}
          <Ellipse cx="60" cy="77" rx="5" ry="4" fill="#E8855A" />
          <Circle cx="57" cy="78" r="1.5" fill="#D4634A" />
          <Circle cx="63" cy="78" r="1.5" fill="#D4634A" />

          {/* Moustache */}
          <Path
            d="M44 85 Q52 90 60 85 Q68 90 76 85"
            stroke="#3D2B1F"
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
          />

          {/* Mouth */}
          {isHappy || isGiggling ? (
            <>
              <Path
                d="M43 90 Q60 108 77 90"
                stroke="#C0392B"
                strokeWidth="2"
                fill="#E74C3C"
              />
              {/* Teeth */}
              <Rect x="50" y="90" width="20" height="8" rx="2" fill="white" />
            </>
          ) : (
            <Path
              d="M48 90 Q60 100 72 90"
              stroke="#C0392B"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
          )}

          {/* Beard */}
          <Path
            d="M28 86 Q26 112 44 120 Q60 126 76 120 Q94 112 92 86 Q80 100 60 103 Q40 100 28 86Z"
            fill="#3D2B1F"
            opacity="0.92"
          />
          {/* Beard highlight streak */}
          <Path
            d="M44 96 Q60 108 76 96 Q70 114 60 116 Q50 114 44 96Z"
            fill="#5C4033"
            opacity="0.55"
          />
          {/* Grey streak in beard */}
          <Path
            d="M57 103 Q60 116 63 103"
            stroke="#9CA3AF"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            opacity="0.6"
          />

          {/* Cheeks when happy */}
          {isHappy && (
            <>
              <Ellipse cx="32" cy="80" rx="8" ry="5" fill="#FFB3BA" opacity="0.55" />
              <Ellipse cx="88" cy="80" rx="8" ry="5" fill="#FFB3BA" opacity="0.55" />
            </>
          )}

          {/* Arms */}
          {isHappy ? (
            <>
              {/* Left arm up */}
              <Path
                d="M26 114 Q8 94 12 76"
                stroke="#3B82F6"
                strokeWidth="13"
                strokeLinecap="round"
                fill="none"
              />
              {/* Left hand */}
              <Circle cx="12" cy="74" r="9" fill="#FBBF7A" />

              {/* Right arm up */}
              <Path
                d="M94 114 Q112 94 108 76"
                stroke="#3B82F6"
                strokeWidth="13"
                strokeLinecap="round"
                fill="none"
              />
              {/* Right hand */}
              <Circle cx="108" cy="74" r="9" fill="#FBBF7A" />
            </>
          ) : (
            <>
              {/* Left arm down */}
              <Path
                d="M26 114 Q12 128 16 144"
                stroke="#3B82F6"
                strokeWidth="13"
                strokeLinecap="round"
                fill="none"
              />
              <Circle cx="16" cy="145" r="9" fill="#FBBF7A" />

              {/* Right arm down */}
              <Path
                d="M94 114 Q108 128 104 144"
                stroke="#3B82F6"
                strokeWidth="13"
                strokeLinecap="round"
                fill="none"
              />
              <Circle cx="104" cy="145" r="9" fill="#FBBF7A" />
            </>
          )}

          {/* Legs */}
          <Rect x="36" y="146" width="18" height="10" rx="5" fill="#1D4ED8" />
          <Rect x="66" y="146" width="18" height="10" rx="5" fill="#1D4ED8" />

          {/* Shoes */}
          <Ellipse cx="45" cy="156" rx="11" ry="5" fill="#111827" />
          <Ellipse cx="75" cy="156" rx="11" ry="5" fill="#111827" />

        </Svg>

        {/* Giggle bubble */}
        {showGiggleText && (
          <Animated.View style={[styles.giggleBubble, { transform: [{ scale: scaleAnim }] }]}>
            <Text style={styles.giggleText}>hehe! 😄</Text>
          </Animated.View>
        )}

        {/* Celebrate emojis */}
        {mood === 'celebrate' && (
          <View style={styles.celebrateRow}>
            <Text style={styles.celebrateEmoji}>🎉</Text>
            <Text style={styles.celebrateEmoji}>⭐</Text>
            <Text style={styles.celebrateEmoji}>🎊</Text>
          </View>
        )}

      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  giggleBubble: {
    position: 'absolute',
    top: -14,
    right: -24,
    backgroundColor: '#FFD93D',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  giggleText: { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  celebrateRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  celebrateEmoji: { fontSize: 20 },
});