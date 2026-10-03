import React from 'react';
import { Image, Text, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

type AvatarProps = {
  uri?: string | null;
  name: string;
  size?: number;
};

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Shows the profile photo when present, otherwise a colored initials
 * circle -- profile photos are optional per onboarding (spec §8). */
export function Avatar({ uri, name, size = 44 }: AvatarProps) {
  const { colors } = useTheme();
  const dimension = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return <Image source={{ uri }} style={dimension} />;
  }

  return (
    <View
      style={[
        dimension,
        {
          backgroundColor: colors.primaryMuted,
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
    >
      <Text
        style={{
          color: colors.primary,
          fontSize: size * 0.36,
          fontFamily: 'SpaceGrotesk_600SemiBold',
        }}
      >
        {initialsFor(name)}
      </Text>
    </View>
  );
}
