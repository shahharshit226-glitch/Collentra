/**
 * Collentra design tokens.
 *
 * Palette rationale: this is a KIIT-only engineering-student collaboration
 * tool, not a generic SaaS dashboard or a dating app (spec §72 explicitly
 * rules out the latter). "Collentra Indigo" is the one saturated color in
 * the system and it means exactly one thing everywhere it appears: the
 * primary action / the thing the app wants you to notice. Everything else
 * is quiet on purpose so that accent isn't fighting for attention. Coral
 * is used even more sparingly, only for the handful of "something needs
 * you" moments (new match, new message) -- not decoration.
 */

export const palette = {
  light: {
    background: '#F5F6F8',
    surface: '#FFFFFF',
    surfaceMuted: '#ECEDF1',
    border: '#E2E4E9',
    ink: '#14151A',
    inkMuted: '#5B5F6B',
    inkFaint: '#8B8F9C',
    primary: '#4B3FE4',
    primaryMuted: '#ECEBFB',
    onPrimary: '#FFFFFF',
    accent: '#FF6B54',
    accentMuted: '#FFEAE6',
    success: '#2F9E64',
    successMuted: '#E4F5EA',
    warning: '#C97A1A',
    warningMuted: '#FBEEDD',
    danger: '#D64545',
    dangerMuted: '#FBE7E7',
    overlay: 'rgba(20, 21, 26, 0.5)',
  },
  dark: {
    background: '#101216',
    surface: '#17191F',
    surfaceMuted: '#1E212A',
    border: '#2B2E38',
    ink: '#F2F3F5',
    inkMuted: '#9A9DAA',
    inkFaint: '#6C7080',
    primary: '#8479F7',
    primaryMuted: '#241F49',
    onPrimary: '#0D0B1F',
    accent: '#FF8468',
    accentMuted: '#3A2620',
    success: '#45B67D',
    successMuted: '#1C3327',
    warning: '#E0973A',
    warningMuted: '#3A2C15',
    danger: '#E8635F',
    dangerMuted: '#3B2020',
    overlay: 'rgba(0, 0, 0, 0.6)',
  },
} as const;

export type ThemeColors = Record<keyof typeof palette.light, string>;

// Two families, clearly distinct roles: Space Grotesk carries personality
// on headings and numbers (match %, team counts); IBM Plex Sans is the
// workhorse for everything you actually read, chosen for its technical,
// legible character over a generic system-default sans.
export const fontFamily = {
  display: {
    regular: 'SpaceGrotesk_400Regular',
    medium: 'SpaceGrotesk_500Medium',
    semibold: 'SpaceGrotesk_600SemiBold',
    bold: 'SpaceGrotesk_700Bold',
  },
  body: {
    regular: 'IBMPlexSans_400Regular',
    medium: 'IBMPlexSans_500Medium',
    semibold: 'IBMPlexSans_600SemiBold',
    bold: 'IBMPlexSans_700Bold',
  },
};

export const typeScale = {
  display: { fontSize: 32, lineHeight: 39, fontFamily: fontFamily.display.bold },
  h1: { fontSize: 26, lineHeight: 32, fontFamily: fontFamily.display.semibold },
  h2: { fontSize: 21, lineHeight: 27, fontFamily: fontFamily.display.semibold },
  h3: { fontSize: 17, lineHeight: 23, fontFamily: fontFamily.display.medium },
  body: { fontSize: 15, lineHeight: 22, fontFamily: fontFamily.body.regular },
  bodyMedium: { fontSize: 15, lineHeight: 22, fontFamily: fontFamily.body.medium },
  bodySmall: { fontSize: 13, lineHeight: 19, fontFamily: fontFamily.body.regular },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: fontFamily.body.medium },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
} as const;

// Deliberately not one radius everywhere (the "SaaS-card kit" default):
// small controls get a small radius, content cards a medium one, sheets/
// modals a large one, pills/badges fully round.
export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

