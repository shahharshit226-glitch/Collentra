import React from 'react';
import { Pressable, Text } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

type SelectableChipProps = {
  label: string;
  selected: boolean;
  onToggle: () => void;
};

/** Unlike Badge (purely informational), this is a pressable, stateful pill
 * -- used for skill/role/interest pickers where the person is choosing
 * from a catalogue rather than reading a status. */
export function SelectableChip({ label, selected, onToggle }: SelectableChipProps) {
  const { colors, radius, spacing, type } = useTheme();

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => ({
        backgroundColor: selected ? colors.primary : colors.surfaceMuted,
        borderRadius: radius.pill,
        paddingVertical: spacing.xs + 2,
        paddingHorizontal: spacing.md,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          color: selected ? colors.onPrimary : colors.inkMuted,
          fontFamily: type.caption.fontFamily,
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
