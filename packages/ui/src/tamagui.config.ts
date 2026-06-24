import { defaultConfig } from '@tamagui/config/v4';
import { createTamagui } from 'tamagui';
import { calendarThemes } from './tokens';

const darkTheme = (defaultConfig.themes as Record<string, Record<string, unknown>>).dark;

export const tamaguiConfig = createTamagui({
  ...defaultConfig,
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
