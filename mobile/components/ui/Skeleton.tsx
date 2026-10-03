import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  style?: ViewStyle;
};

/** A pulsing placeholder block for loading states. Plain RN `Animated` --
 * no reanimated dependency needed for something this simple. */
export function Skeleton({ width = '100%', height = 16, style }: SkeletonProps) {
  const { colors, radius } = useTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius.sm,
          backgroundColor: colors.surfaceMuted,
          opacity,
        },
        style,
      ]}
    />
  );
}
