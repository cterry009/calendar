export { CalendarProvider, tamaguiConfig } from './CalendarProvider';
// Raw Tamagui provider/theme primitives -- exported for native, which needs to wrap them
// with its own platform-specific config (tamagui.config.native.ts) instead of CalendarProvider's
// hardcoded web one. Re-exported from here (not imported directly from 'tamagui') for the same
// reason icons are re-exported in components/index.ts: keep every consumer on one @tamagui/core
// instance.
export { TamaguiProvider, Theme } from 'tamagui';
export { calendarThemes, palette, paletteLight, space, fontSize } from './tokens';
export type { CalendarTheme } from './tokens';
export {
  Activity,
  AppButton,
  AppCard,
  BarChart3,
  Eyebrow,
  Flame,
  Heart,
  HelpCircle,
  Label,
  Leaf,
  Lightbulb,
  ListChecks,
  Plus,
  ScoreDisplay,
  Settings,
  ShieldBan,
  Sunrise,
  Text,
  Timer,
  YStack,
  XStack,
  H1,
  H2,
  H3,
  Paragraph,
} from './components/index';
export type { IconProps } from './components/index';
