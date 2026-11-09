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
  // Generic translucent overlays (button hover/press washes, resting fills)
  // that assume a dark backdrop — values match what AppButton hardcoded
  // before these existed, so dark mode is pixel-identical.
  overlaySubtle: 'rgba(255,255,255,0.05)',
  overlayMedium: 'rgba(255,255,255,0.09)',
  overlayStrong: 'rgba(255,255,255,0.15)',
  // A sunken/recessed row fill (list rows inside a card) — darkens against
  // its surface regardless of theme, unlike the overlay tokens above which
  // lighten on dark and darken on light.
  recessedFill: 'rgba(0,0,0,0.2)',
} as const;

// Same "Emerald Focus" family as `palette`, inverted for a light backdrop:
// off-white ground instead of near-black, deepened accent/semantic colors
// for real contrast against white (a straight lightness-flip of the dark
// hex values reads as washed-out and fails contrast, same problem every
// light/dark design system solves by shifting lightness per-theme while
// keeping the same hue).
export const paletteLight = {
  background: '#f2f8f5',
  surface: '#ffffff',
  surfaceHover: '#e6f2ec',
  text: '#16241d',
  textMuted: '#54695f',
  accent: '#1a9d68',
  accentSoft: '#dbf3e7',
  success: '#2f8f5c',
  warning: '#9a6f1c',
  danger: '#c1503b',
  border: 'rgba(22,36,29,0.12)',
  borderHighlight: 'rgba(22,60,40,0.2)',
  shadow: 'rgba(22,36,29,0.16)',
  shadowAmbient: 'rgba(22,36,29,0.08)',
  overlaySubtle: 'rgba(22,36,29,0.05)',
  overlayMedium: 'rgba(22,36,29,0.09)',
  overlayStrong: 'rgba(22,36,29,0.15)',
  // Lower alpha than dark's recessedFill -- the same 0.2 black-on-white would
  // read as a flat gray block instead of a subtle recess.
  recessedFill: 'rgba(22,36,29,0.06)',
} as const;

// "Agenda" palettes (2026-11-08): the look of the project board the user liked (Claude artifact
// "Agenda de Cristo") -- cool graphite neutrals with a cobalt accent, light and dark. Opt-in from
// Configuración on web/desktop while the redesign (change after projects-and-claude-bridge) lands.
export const paletteAgenda = {
  background: '#f3f4f7',
  surface: '#ffffff',
  surfaceHover: '#eef1f6',
  text: '#1b2130',
  textMuted: '#5b6476',
  accent: '#2d56c8',
  accentSoft: '#e7edfb',
  onAccent: '#ffffff',
  success: '#2f855a',
  warning: '#b26d12',
  danger: '#c43a3a',
  border: '#dde1e9',
  borderHighlight: 'rgba(45,86,200,0.35)',
  shadow: 'rgba(27,33,48,0.12)',
  shadowAmbient: 'rgba(27,33,48,0.06)',
  overlaySubtle: 'rgba(27,33,48,0.04)',
  overlayMedium: 'rgba(27,33,48,0.08)',
  overlayStrong: 'rgba(27,33,48,0.14)',
  recessedFill: 'rgba(27,33,48,0.04)',
} as const;

export const paletteAgendaDark = {
  background: '#11141b',
  surface: '#191e28',
  surfaceHover: '#212838',
  text: '#e6e9ef',
  textMuted: '#9aa3b4',
  accent: '#86a2ff',
  accentSoft: '#1f2946',
  onAccent: '#0d1222',
  success: '#62c08d',
  warning: '#e3a54d',
  danger: '#f07a7a',
  border: '#2a3141',
  borderHighlight: 'rgba(134,162,255,0.35)',
  shadow: 'rgba(0,0,0,0.45)',
  shadowAmbient: 'rgba(0,0,0,0.25)',
  overlaySubtle: 'rgba(255,255,255,0.04)',
  overlayMedium: 'rgba(255,255,255,0.08)',
  overlayStrong: 'rgba(255,255,255,0.14)',
  recessedFill: 'rgba(0,0,0,0.25)',
} as const;

type AgendaPalette = typeof paletteAgenda | typeof paletteAgendaDark;
const agendaTheme = (p: AgendaPalette) => ({
  background: p.background,
  color: p.text,
  colorHover: p.text,
  colorPress: p.text,
  colorFocus: p.text,
  borderColor: p.border,
  borderColorHover: p.borderHighlight,
  borderColorFocus: p.accent,
  placeholderColor: p.textMuted,
  accent: p.accent,
  accentBackground: p.accentSoft,
  onAccent: p.onAccent,
  surface: p.surface,
  surfaceHover: p.surfaceHover,
  muted: p.textMuted,
  success: p.success,
  warning: p.warning,
  danger: p.danger,
  error: p.danger,
  shadowColor: p.shadow,
  overlaySubtle: p.overlaySubtle,
  overlayMedium: p.overlayMedium,
  overlayStrong: p.overlayStrong,
  recessedFill: p.recessedFill,
});

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
    onAccent: '#0a1c13',
    surface: palette.surface,
    surfaceHover: palette.surfaceHover,
    muted: palette.textMuted,
    success: palette.success,
    warning: palette.warning,
    danger: palette.danger,
    error: palette.danger,
    shadowColor: palette.shadow,
    overlaySubtle: palette.overlaySubtle,
    overlayMedium: palette.overlayMedium,
    overlayStrong: palette.overlayStrong,
    recessedFill: palette.recessedFill,
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
    onAccent: '#0a1c13',
    surface: palette.surfaceCalm,
    surfaceHover: palette.surfaceHoverCalm,
    muted: palette.textMuted,
    success: palette.success,
    warning: palette.warning,
    danger: palette.danger,
    error: palette.danger,
    shadowColor: palette.shadow,
    overlaySubtle: palette.overlaySubtle,
    overlayMedium: palette.overlayMedium,
    overlayStrong: palette.overlayStrong,
    recessedFill: palette.recessedFill,
  },
  light: {
    background: paletteLight.background,
    color: paletteLight.text,
    colorHover: paletteLight.text,
    colorPress: paletteLight.text,
    colorFocus: paletteLight.text,
    borderColor: paletteLight.border,
    borderColorHover: paletteLight.borderHighlight,
    borderColorFocus: paletteLight.accent,
    placeholderColor: paletteLight.textMuted,
    accent: paletteLight.accent,
    accentBackground: paletteLight.accentSoft,
    onAccent: '#0a1c13',
    surface: paletteLight.surface,
    surfaceHover: paletteLight.surfaceHover,
    muted: paletteLight.textMuted,
    success: paletteLight.success,
    warning: paletteLight.warning,
    danger: paletteLight.danger,
    error: paletteLight.danger,
    shadowColor: paletteLight.shadow,
    overlaySubtle: paletteLight.overlaySubtle,
    overlayMedium: paletteLight.overlayMedium,
    overlayStrong: paletteLight.overlayStrong,
    recessedFill: paletteLight.recessedFill,
  },
  agendaLight: agendaTheme(paletteAgenda),
  agendaDark: agendaTheme(paletteAgendaDark),
} as const;

export type CalendarTheme = keyof typeof calendarThemes;
