import { defaultConfig } from '@tamagui/config/v4';
import { createFont, createTamagui } from 'tamagui';
import { calendarThemes } from './tokens';

const darkTheme = (defaultConfig.themes as Record<string, Record<string, unknown>>).dark;

const fontFamily = 'Outfit, -apple-system, system-ui, "Segoe UI", sans-serif';

const sizes = {
  1: 11,
  2: 12,
  3: 13,
  4: 14,
  true: 14,
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

export const tamaguiConfig = createTamagui({
  ...defaultConfig,
  fonts: {
    ...defaultConfig.fonts,
    body: appFont,
    heading: appFont,
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
