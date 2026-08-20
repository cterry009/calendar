import { defaultConfig } from '@tamagui/config/v4';
import { createAnimations } from '@tamagui/animations-css';
import { createAppTamaguiConfig } from './createTamaguiConfig';

// Slight overshoot spring — gives buttons/cards a "magnetic" settle instead of
// a flat linear/ease-in snap. Kept alongside the existing named curves.
const appAnimations = createAnimations({
  ...(defaultConfig.animations as { animations: Record<string, string> }).animations,
  magnetic: 'cubic-bezier(0.34, 1.56, 0.64, 1) 320ms',
});

export const tamaguiConfig = createAppTamaguiConfig(appAnimations);

export type AppTamaguiConfig = typeof tamaguiConfig;

declare module 'tamagui' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TamaguiCustomConfig extends AppTamaguiConfig {}
}

export default tamaguiConfig;
