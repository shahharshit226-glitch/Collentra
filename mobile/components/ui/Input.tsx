import React, { useState } from 'react';
import { Text, TextInput, TextInputProps, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
};

export function Input({ label, error, style, onFocus, onBlur, ...rest }: InputProps) {
  const { colors, radius, spacing, fontFamily } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

  return (
    <View style={{ gap: spacing.xs }}>
      {label ? (
        <Text style={{ color: colors.inkMuted, fontFamily: fontFamily.body.medium, fontSize: 13 }}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.inkFaint}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          {
            borderWidth: 1,
            borderColor,
            borderRadius: radius.sm,
            paddingVertical: spacing.sm + 2,
            paddingHorizontal: spacing.md,
            color: colors.ink,
            fontFamily: fontFamily.body.regular,
            fontSize: 15,
            backgroundColor: colors.surface,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text style={{ color: colors.danger, fontFamily: fontFamily.body.regular, fontSize: 12 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
