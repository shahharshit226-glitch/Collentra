import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

type BadgeProps = {
  label: string;
  tone?: Tone;
};

/** Used for skill/interest/role chips and status labels (e.g. the
 * "Available to Collaborate" indicator, spec §16). Not a button --
 * purely informational, so it's not a Pressable. */
export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const { colors, radius, spacing, type } = useTheme();

  const toneColors: Record<Tone, { bg: string; fg: string }> = {
    neutral: { bg: colors.surfaceMuted, fg: colors.inkMuted },
    primary: { bg: colors.primaryMuted, fg: colors.primary },
    success: { bg: colors.successMuted, fg: colors.success },
    warning: { bg: colors.warningMuted, fg: colors.warning },
    danger: { bg: colors.dangerMuted, fg: colors.danger },
  };
  const { bg, fg } = toneColors[tone];

  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: radius.pill,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: fg, fontFamily: type.caption.fontFamily, fontSize: type.caption.fontSize }}>
        {label}
      </Text>
    </View>
  );
}
