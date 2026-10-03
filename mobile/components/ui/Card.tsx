import React from 'react';
import { Pressable, View, ViewStyle } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

type CardProps = {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
};

/** A content card. Pass `onPress` to make the whole card tappable (project
 * cards, student cards); omit it for a purely informational container. */
export function Card({ children, onPress, style }: CardProps) {
  const { colors, radius, spacing } = useTheme();
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [base, { opacity: pressed ? 0.9 : 1 }, style]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[base, style]}>{children}</View>;
}
