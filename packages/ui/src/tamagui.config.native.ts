import { createAnimations } from '@tamagui/animations-react-native';
import { createAppTamaguiConfig } from './createTamaguiConfig';

// Reanimated-driven equivalents of the CSS animation keys defined in
// tamagui.config.ts (web) -- same key names so `animation="quick"` /
// AppButton's default `animation: 'magnetic'` resolve identically on
// both platforms, just via a different driver (RN has no CSS transitions).
const appAnimations = createAnimations({
  '75ms': { type: 'timing', duration: 75 },
  '100ms': { type: 'timing', duration: 100 },
  '200ms': { type: 'timing', duration: 200 },
  bouncy: { type: 'spring', damping: 10, mass: 0.9, stiffness: 100 },
  superBouncy: { type: 'spring', damping: 8, mass: 1, stiffness: 120 },
  lazy: { type: 'timing', duration: 1000 },
  medium: { type: 'timing', duration: 300 },
  slow: { type: 'timing', duration: 500 },
  quick: { type: 'spring', damping: 20, mass: 1.2, stiffness: 250 },
  quicker: { type: 'spring', damping: 20, mass: 1, stiffness: 300 },
  quickest: { type: 'spring', damping: 20, mass: 0.8, stiffness: 350 },
  tooltip: { type: 'timing', duration: 400 },
  // Slight overshoot spring — mirrors the web "magnetic" cubic-bezier's
  // settle-with-a-little-bounce feel using RN's native spring physics.
  magnetic: { type: 'spring', damping: 12, mass: 1, stiffness: 220 },
});

export const tamaguiConfig = createAppTamaguiConfig(appAnimations);

export type AppTamaguiConfigNative = typeof tamaguiConfig;

export default tamaguiConfig;
