/**
 * Design tokens for Calendar Productivity — "Circadian" system.
 *
 * The two themes are not a superficial light/dark toggle: they model the
 * app's own thesis. Focus mode is a cool, low-light workspace for deep work;
 * Calm mode is warm dawn-paper for Serotonin Mode and the detox flow. Switching
 * between them should feel like the light changing, not just a color swap.
 */

export const palette = {
  focus: {
    background: '#12151b',
    backgroundElevated: '#181c24',
    surface: '#1b212b',
    surfaceRaised: '#212836',
    text: '#eaf0ee',
    textMuted: '#8d99a6',
    accent: '#4fb6a6',
    accentSoft: '#2c5350',
    border: 'rgba(234,240,238,0.08)',
    borderStrong: 'rgba(79,182,166,0.35)',
  },
  calm: {
    background: '#f6efe4',
    backgroundElevated: '#faf5ec',
    surface: '#fffcf6',
    surfaceRaised: '#ffffff',
    text: '#35291f',
    textMuted: '#8a7a68',
    accent: '#c9754a',
    accentSoft: 'rgba(201,117,74,0.16)',
    border: 'rgba(53,41,31,0.1)',
    borderStrong: 'rgba(201,117,74,0.35)',
  },
  shared: {
    success: '#6fae7c',
    danger: '#c4614a',
  },
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

export const radius = {
  1: 4,
  2: 6,
  3: 8,
  4: 10,
  5: 14,
  6: 20,
} as const;

/** Theme overrides merged into Tamagui v4 dark/calm themes */
export const calendarThemes = {
  dark: {
    background: palette.focus.background,
    backgroundHover: palette.focus.backgroundElevated,
    color: palette.focus.text,
    colorHover: palette.focus.text,
    colorPress: palette.focus.text,
    colorFocus: palette.focus.text,
    borderColor: palette.focus.border,
    borderColorHover: palette.focus.borderStrong,
    borderColorFocus: palette.focus.accent,
    placeholderColor: palette.focus.textMuted,
    accent: palette.focus.accent,
    accentBackground: palette.focus.accentSoft,
    surface: palette.focus.surface,
    surfaceRaised: palette.focus.surfaceRaised,
    muted: palette.focus.textMuted,
    success: palette.shared.success,
    danger: palette.shared.danger,
    shadowColor: 'rgba(0,0,0,0.45)',
  },
  calm: {
    background: palette.calm.background,
    backgroundHover: palette.calm.backgroundElevated,
    color: palette.calm.text,
    colorHover: palette.calm.text,
    colorPress: palette.calm.text,
    colorFocus: palette.calm.text,
    borderColor: palette.calm.border,
    borderColorHover: palette.calm.borderStrong,
    borderColorFocus: palette.calm.accent,
    placeholderColor: palette.calm.textMuted,
    accent: palette.calm.accent,
    accentBackground: palette.calm.accentSoft,
    surface: palette.calm.surface,
    surfaceRaised: palette.calm.surfaceRaised,
    muted: palette.calm.textMuted,
    success: palette.shared.success,
    danger: palette.shared.danger,
    shadowColor: 'rgba(53,41,31,0.12)',
  },
} as const;

export type CalendarTheme = keyof typeof calendarThemes;
