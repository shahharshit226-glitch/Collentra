import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { palette, radius, spacing, typeScale, fontFamily, type ThemeColors } from '@/constants/theme';

type Theme = {
  scheme: 'light' | 'dark';
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  type: typeof typeScale;
  fontFamily: typeof fontFamily;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  // No manual override in Phase 1 -- the app just follows the system
  // setting. A settings-screen toggle can layer on top of this later
  // without changing how any screen consumes the theme.
  const scheme: 'light' | 'dark' = systemScheme === 'dark' ? 'dark' : 'light';

  const value = useMemo<Theme>(
    () => ({
      scheme,
      colors: palette[scheme],
      spacing,
      radius,
      type: typeScale,
      fontFamily,
    }),
    [scheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme() must be called inside a <ThemeProvider>.');
  }
  return ctx;
}
