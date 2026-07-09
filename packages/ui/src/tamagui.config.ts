import { defaultConfig } from '@tamagui/config/v4';
import { createFont, createTamagui } from 'tamagui';
import { calendarThemes, fontSize } from './tokens';

const darkTheme = (defaultConfig.themes as Record<string, Record<string, unknown>>).dark;

const scale = (multiplier: number, offset = 0) =>
  Object.fromEntries(Object.entries(fontSize).map(([key, value]) => [key, Math.round(Number(value) * multiplier) + offset]));

/** Body/UI text — quiet, precise, carries the data-heavy surfaces (timers, forms, lists). */
const bodyFont = createFont({
  family: '"Inter", -apple-system, system-ui, "Segoe UI", sans-serif',
  size: fontSize,
  lineHeight: scale(1.4, 4),
  weight: { 1: '400', 4: '400', 6: '600' },
  letterSpacing: { 1: 0, 4: 0, 6: -0.2 },
});

/** Display headings — warm, humanist serif that carries the product's character. */
const headingFont = createFont({
  family: '"Fraunces", Georgia, serif',
  size: scale(1.3),
  lineHeight: scale(1.5, 4),
  weight: { 1: '500', 4: '500', 6: '600' },
  letterSpacing: { 1: 0, 4: 0 },
});

export const tamaguiConfig = createTamagui({
  ...defaultConfig,
  fonts: {
    ...defaultConfig.fonts,
    body: bodyFont,
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
