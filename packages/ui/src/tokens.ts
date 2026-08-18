/** Design tokens for Calendar Productivity — colors, spacing, typography */

// "Emerald Focus" palette — medium gray-green grounds a vivid emerald
// accent. Deliberately not near-black: dark mode without feeling like a
// void. The calm theme is the same family at lower saturation, so
// switching modes reads as a shift in intensity, not a different app.
export const palette = {
  background: '#212e28',
  backgroundCalm: '#25332c',
  surface: '#2a3931',
  surfaceHover: '#34473c',
  surfaceCalm: '#283a30',
  surfaceHoverCalm: '#33493d',
  text: '#f2f7f4',
  textMuted: '#a9c2b4',
  accent: '#4ee0a0',
  accentSoft: '#234436',
  accentCalm: '#8fe3c0',
  success: '#4caf82',
  warning: '#e0b64c',
  danger: '#e88a76',
  border: 'rgba(180,255,220,0.10)',
  borderCalm: 'rgba(143,227,192,0.28)',
  borderHighlight: 'rgba(200,255,230,0.12)',
  // Diffused ambient shadow — darker than the background so cards still read
  // as raised even though the base is no longer near-black.
  shadow: 'rgba(6,12,9,0.5)',
  shadowAmbient: 'rgba(6,12,9,0.25)',
} as const;

export const radius = {
  1: 6,
  2: 10,
  3: 14,
  4: 18,
  5: 22,
  6: 28,
  pill: 999,
} as const;

export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 32,
  8: 40,
  9: 48,
  10: 64,
} as const;

export const fontSize = {
  1: 11,
  2: 12,
  3: 13,
  4: 14,
  true: 14,
  5: 16,
  6: 18,
  7: 20,
  8: 24,
  9: 28,
  10: 32,
} as const;

/** Theme overrides merged into Tamagui v4 dark/calm themes */
export const calendarThemes = {
  dark: {
    background: palette.background,
    color: palette.text,
    colorHover: palette.text,
    colorPress: palette.text,
    colorFocus: palette.text,
    borderColor: palette.border,
    borderColorHover: palette.borderCalm,
    borderColorFocus: palette.accent,
    placeholderColor: palette.textMuted,
    accent: palette.accent,
    accentBackground: palette.accentSoft,
    surface: palette.surface,
    surfaceHover: palette.surfaceHover,
    muted: palette.textMuted,
    success: palette.success,
    warning: palette.warning,
    danger: palette.danger,
    error: palette.danger,
    shadowColor: palette.shadow,
  },
  calm: {
    background: palette.backgroundCalm,
    color: palette.text,
    colorHover: palette.text,
    colorPress: palette.text,
    colorFocus: palette.text,
    borderColor: palette.borderCalm,
    borderColorHover: palette.borderCalm,
    borderColorFocus: palette.accentCalm,
    placeholderColor: palette.textMuted,
    accent: palette.accentCalm,
    accentBackground: 'rgba(127,217,171,0.15)',
    surface: palette.surfaceCalm,
    surfaceHover: palette.surfaceHoverCalm,
    muted: palette.textMuted,
    success: palette.success,
    warning: palette.warning,
    danger: palette.danger,
    error: palette.danger,
    shadowColor: palette.shadow,
  },
} as const;

export type CalendarTheme = keyof typeof calendarThemes;
