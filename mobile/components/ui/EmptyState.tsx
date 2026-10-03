import React from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { Button } from './Button';

type EmptyStateProps = {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** An empty screen is an invitation to act, not an apology (spec §74) --
 * every empty state here names what's missing and what to do about it. */
export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  const { colors, spacing, type, fontFamily } = useTheme();

  return (
    <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing.sm }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.surfaceMuted,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.xs,
        }}
      >
        <Feather name={icon} size={24} color={colors.inkMuted} />
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
      {description ? (
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
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} size="sm" style={{ marginTop: spacing.sm }} />
      ) : null}
    </View>
  );
}
