import React from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { Button } from './Button';

type ErrorStateProps = {
  title?: string;
  description: string;
  onRetry?: () => void;
};

/** Never surface a raw error (spec §75 -- no "PostgrestException 23505").
 * Callers translate the underlying error into plain language before
 * passing it here; this component just presents it consistently. */
export function ErrorState({ title = 'Something went wrong', description, onRetry }: ErrorStateProps) {
  const { colors, spacing, type, fontFamily } = useTheme();

  return (
    <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing.sm }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.dangerMuted,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.xs,
        }}
      >
        <Feather name="alert-circle" size={24} color={colors.danger} />
      </View>
      <Text
        style={{
          color: colors.ink,
          fontFamily: fontFamily.display.medium,
          fontSize: type.h3.fontSize,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: colors.inkMuted,
          fontFamily: fontFamily.body.regular,
          fontSize: type.body.fontSize,
          textAlign: 'center',
        }}
      >
        {description}
      </Text>
      {onRetry ? (
        <Button label="Try again" onPress={onRetry} variant="secondary" size="sm" style={{ marginTop: spacing.sm }} />
      ) : null}
    </View>
  );
}
