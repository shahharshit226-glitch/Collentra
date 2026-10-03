import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const { colors, radius, spacing, fontFamily } = useTheme();
  const isDisabled = disabled || loading;

  const backgroundFor: Record<Variant, string> = {
    primary: colors.primary,
    secondary: colors.surfaceMuted,
    ghost: 'transparent',
    danger: colors.danger,
  };
  const textColorFor: Record<Variant, string> = {
    primary: colors.onPrimary,
    secondary: colors.ink,
    ghost: colors.primary,
    danger: '#FFFFFF',
  };
  const borderFor: Record<Variant, string | undefined> = {
    primary: undefined,
    secondary: colors.border,
    ghost: undefined,
    danger: undefined,
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      onPress={onPress}
      disabled={isDisabled}
      hitSlop={8}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: backgroundFor[variant],
          borderColor: borderFor[variant],
          borderWidth: borderFor[variant] ? 1 : 0,
          borderRadius: radius.md,
          paddingVertical: size === 'sm' ? spacing.sm : spacing.md,
          paddingHorizontal: size === 'sm' ? spacing.md : spacing.lg,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColorFor[variant]} />
      ) : (
        <Text
          style={{
            color: textColorFor[variant],
            fontFamily: fontFamily.body.semibold,
            fontSize: size === 'sm' ? 13 : 15,
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
});
