import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

export function Toast({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  const { colors, spacing, radius, type, fontFamily } = useTheme();
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, 2600);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);
  if (!message) return null;
  return <View accessibilityRole="alert" style={{ position: 'absolute', bottom: spacing.xl, left: spacing.lg, right: spacing.lg, backgroundColor: colors.ink, borderRadius: radius.md, padding: spacing.md, elevation: 8 }}><Text style={{ color: colors.surface, fontFamily: fontFamily.body.medium, fontSize: type.bodySmall.fontSize, textAlign: 'center' }}>{message}</Text></View>;
}
