import { defaultConfig } from '@tamagui/config/v4';
import { createAnimations } from '@tamagui/animations-css';
import { createFont, createTamagui } from 'tamagui';
import { calendarThemes } from './tokens';

const darkTheme = (defaultConfig.themes as Record<string, Record<string, unknown>>).dark;

const fontFamily = 'Outfit, -apple-system, system-ui, "Segoe UI", sans-serif';
// Editorial serif reserved for display headings — pairs with the geometric
// Outfit sans used everywhere else for a deliberate, premium contrast.
const headingFontFamily = 'Fraunces, Georgia, serif';

// `true` is what Paragraph/Text/Button resolve to when no explicit size is
// set — kept at 16px (not 14) so default body copy clears the 16px minimum
// for comfortable reading instead of relying on every call site to opt in.
const sizes = {
  1: 11,
  2: 12,
  3: 13,
  4: 14,
  true: 16,
  5: 16,
  6: 18,
  7: 20,
  8: 23,
  9: 30,
  10: 46,
  11: 55,
  12: 62,
  13: 72,
  14: 92,
  15: 114,
  16: 134,
} as const;

// Negative tracking on large display sizes gives headlines presence; small
// labels get slightly positive tracking so they read cleanly in caps/eyebrows.
const letterSpacing = {
  1: 0.2,
  2: 0.1,
  3: 0,
  4: 0,
  true: 0,
  5: 0,
  6: -0.1,
  7: -0.2,
  8: -0.3,
  9: -0.5,
  10: -0.8,
  11: -1,
  12: -1.2,
  13: -1.4,
  14: -1.6,
  15: -1.8,
  16: -2,
} as const;

const weight = {
  1: '400',
  4: '400',
  6: '500',
  8: '600',
  10: '700',
  12: '800',
} as const;

const appFont = createFont({
  family: fontFamily,
  size: sizes,
  lineHeight: Object.fromEntries(Object.entries(sizes).map(([k, v]) => [k, +v + 10])) as typeof sizes,
  letterSpacing,
  weight,
});

const headingFont = createFont({
  family: headingFontFamily,
  size: sizes,
  lineHeight: Object.fromEntries(Object.entries(sizes).map(([k, v]) => [k, +v + 10])) as typeof sizes,
  letterSpacing,
  weight,
});

// Slight overshoot spring — gives buttons/cards a "magnetic" settle instead of
// a flat linear/ease-in snap. Kept alongside the existing named curves.
const appAnimations = createAnimations({
  ...(defaultConfig.animations as { animations: Record<string, string> }).animations,
  magnetic: 'cubic-bezier(0.34, 1.56, 0.64, 1) 320ms',
});

export const tamaguiConfig = createTamagui({
  ...defaultConfig,
  animations: appAnimations,
  fonts: {
    ...defaultConfig.fonts,
    body: appFont,
    heading: headingFont,
  },
  themes: {
    ...defaultConfig.themes,
    dark: {
      ...darkTheme,
      ...calendarThemes.dark,
    },
    calm: {
      ...darkTheme,
      ...calendarThemes.calm,
    },
  },
  defaultTheme: 'dark',
});

export type AppTamaguiConfig = typeof tamaguiConfig;

declare module 'tamagui' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TamaguiCustomConfig extends AppTamaguiConfig {}
}

export default tamaguiConfig;
