import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

const COLORS = [
  '#FF6B9D', '#FFB347', '#4CAF50', '#2196F3',
  '#9C27B0', '#FF5722', '#FFEB3B', '#00BCD4',
  '#E91E63', '#8BC34A',
];

const NUM_PARTICLES = 40;

interface ConfettiProps {
  onDone?: () => void;
}

interface Particle {
  anim: Animated.Value;
  startX: number;
  endX: number;
  color: string;
  size: number;
  delay: number;
  duration: number;
  shape: 'square' | 'circle' | 'rect';
}

export default function Confetti({ onDone }: ConfettiProps) {
  const particles = useRef<Particle[]>(
    Array.from({ length: NUM_PARTICLES }, () => ({
      anim: new Animated.Value(0),
      startX: Math.random() * W,
      endX: (Math.random() - 0.5) * 200,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: Math.random() * 10 + 6,
      delay: Math.random() * 800,
      duration: Math.random() * 1500 + 2000,
      shape: (['square', 'circle', 'rect'] as const)[Math.floor(Math.random() * 3)],
    }))
  ).current;

  useEffect(() => {
    const animations = particles.map(p =>
      Animated.sequence([
        Animated.delay(p.delay),
        Animated.timing(p.anim, {
          toValue: 1,
          duration: p.duration,
          useNativeDriver: true,
        }),
      ])
    );

    Animated.parallel(animations).start(() => {
      onDone?.();
    });

    return () => {
      particles.forEach(p => p.anim.stopAnimation());
    };
  }, []);

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {particles.map((p, i) => {
        const translateY = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [-20, H + 20],
        });
        const translateX = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [p.startX, p.startX + p.endX],
        });
        const rotate = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${Math.random() > 0.5 ? '' : '-'}${Math.floor(Math.random() * 720 + 360)}deg`],
        });
        const opacity = p.anim.interpolate({
          inputRange: [0, 0.8, 1],
          outputRange: [1, 1, 0],
        });

        const borderRadius =
          p.shape === 'circle' ? p.size / 2 :
          p.shape === 'rect' ? 2 : 3;
        const width = p.shape === 'rect' ? p.size * 0.5 : p.size;

        return (
          <Animated.View
            key={i}
            style={[
              {
                position: 'absolute',
                top: 0,
                left: 0,
                width,
                height: p.size,
                backgroundColor: p.color,
                borderRadius,
              },
              {
                transform: [{ translateX }, { translateY }, { rotate }],
                opacity,
              },
            ]}
          />
        );
      })}
    </View>
  );
}
