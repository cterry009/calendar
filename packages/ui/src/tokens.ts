/** Design tokens for Calendar Productivity — colors, spacing, typography */

export const palette = {
  background: '#0f1419',
  backgroundCalm: '#121a22',
  surface: '#1a2332',
  surfaceCalm: '#1c2836',
  text: '#e8eef4',
  textMuted: '#8b9cb3',
  accent: '#5b9fd4',
  accentSoft: '#2d5a7b',
  accentCalm: '#7eb8a2',
  success: '#4caf82',
  border: 'rgba(255,255,255,0.06)',
  borderCalm: 'rgba(126,184,162,0.25)',
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
    muted: palette.textMuted,
    success: palette.success,
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
    accentBackground: 'rgba(126,184,162,0.15)',
    surface: palette.surfaceCalm,
    muted: palette.textMuted,
    success: palette.success,
  },
} as const;

export type CalendarTheme = keyof typeof calendarThemes;
