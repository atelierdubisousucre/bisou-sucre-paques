import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions, Platform } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');
const COLORS = ['#FF6B9D','#FFB347','#4CAF50','#2196F3','#9C27B0','#FFEB3B','#E91E63'];
const ND = Platform.OS !== 'web';

interface Props { onDone?: () => void; }

export default function Confetti({ onDone }: Props) {
  const particles = useRef(
    Array.from({ length: 35 }, () => ({
      anim:     new Animated.Value(0),
      startX:   Math.random() * W,
      endX:     (Math.random() - 0.5) * 180,
      color:    COLORS[Math.floor(Math.random() * COLORS.length)],
      size:     Math.random() * 10 + 6,
      delay:    Math.random() * 700,
      duration: Math.random() * 1500 + 2000,
    }))
  ).current;

  useEffect(() => {
    const anims = particles.map(p =>
      Animated.sequence([
        Animated.delay(p.delay),
        Animated.timing(p.anim, { toValue: 1, duration: p.duration, useNativeDriver: ND }),
      ])
    );
    Animated.parallel(anims).start(() => onDone?.());
    return () => particles.forEach(p => p.anim.stopAnimation());
  }, []);

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {particles.map((p, i) => {
        const tY = p.anim.interpolate({ inputRange:[0,1], outputRange:[-20, H+20] });
        const tX = p.anim.interpolate({ inputRange:[0,1], outputRange:[p.startX, p.startX+p.endX] });
        const opacity = p.anim.interpolate({ inputRange:[0,0.8,1], outputRange:[1,1,0] });
        return (
          <Animated.View key={i} style={[
            { position:'absolute', top:0, left:0, width:p.size, height:p.size,
              backgroundColor:p.color, borderRadius:p.size/2 },
            { transform:[{translateX:tX},{translateY:tY}], opacity }
          ]}/>
        );
      })}
    </View>
  );
}
