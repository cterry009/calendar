import { styled, Button as TamaguiButton, Card as TamaguiCard, Label as TamaguiLabel, Text, YStack, XStack, H1 as TamaguiH1, H2 as TamaguiH2, H3 as TamaguiH3, Paragraph } from 'tamagui';
import { radius } from '../tokens';

// Re-exported here (not imported directly from apps/web) so every icon shares the same
// @tamagui/core instance as the rest of the design system -- importing @tamagui/lucide-icons
// from a package with its own separate node_modules breaks the Tamagui theme context.
export { Activity, BarChart3, Leaf, Lightbulb, ListChecks, Plus, ShieldBan, Sunrise, Timer } from '@tamagui/lucide-icons';
export type { IconProps } from '@tamagui/helpers-icon';

export const AppButton = styled(TamaguiButton, {
  name: 'AppButton',
  borderRadius: radius.pill,
  fontWeight: '600',
  cursor: 'pointer',
  animation: 'magnetic',
  focusStyle: { outlineColor: '$accent', outlineWidth: 2, outlineStyle: 'solid', outlineOffset: 2 },
  hoverStyle: { y: -1 },
  pressStyle: { scale: 0.98, y: 0 },
  disabledStyle: { opacity: 0.5, cursor: 'not-allowed', y: 0 },
  variants: {
    variant: {
      primary: {
        backgroundColor: '$accent',
        color: '#0a1c13',
        hoverStyle: { backgroundColor: '$accent', opacity: 0.9, y: -1 },
        pressStyle: { backgroundColor: '$accent', opacity: 0.85, scale: 0.98, y: 0 },
      },
      ghost: {
        backgroundColor: 'transparent',
        color: '$color',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        hoverStyle: { borderColor: '$accent', backgroundColor: 'rgba(255,255,255,0.04)', y: -1 },
        pressStyle: { backgroundColor: 'rgba(255,255,255,0.08)', scale: 0.98, y: 0 },
      },
      small: {
        backgroundColor: '$accentBackground',
        color: '$color',
        paddingHorizontal: '$3',
        paddingVertical: '$2',
        fontSize: '$3',
        hoverStyle: { backgroundColor: '$accentBackground', opacity: 0.85, y: -1 },
        pressStyle: { backgroundColor: '$accentBackground', opacity: 0.75, scale: 0.98, y: 0 },
      },
      mood: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        color: '$color',
        fontWeight: '500',
        flex: 1,
        minWidth: 120,
        hoverStyle: { backgroundColor: 'rgba(255,255,255,0.1)', y: -1 },
        pressStyle: { backgroundColor: 'rgba(255,255,255,0.14)', scale: 0.98, y: 0 },
      },
      // Visually separates destructive actions from routine ones (edit,
      // save) so a slip can't land on "delete" by mistake.
      danger: {
        backgroundColor: 'transparent',
        color: '$danger',
        borderWidth: 1,
        borderColor: 'rgba(232,138,118,0.35)',
        hoverStyle: { borderColor: '$danger', backgroundColor: 'rgba(232,138,118,0.08)', y: -1 },
        pressStyle: { backgroundColor: 'rgba(232,138,118,0.14)', scale: 0.98, y: 0 },
      },
    },
  } as const,
  defaultVariants: {
    variant: 'primary',
  },
});

export const AppCard = styled(TamaguiCard, {
  name: 'AppCard',
  backgroundColor: '$surface',
  borderWidth: 1,
  borderColor: '$borderColor',
  borderRadius: radius[5],
  padding: '$6',
  elevate: false,
  animation: 'quick',
  shadowColor: '$shadowColor',
  shadowRadius: 28,
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 1,
  variants: {
    variant: {
      default: {},
      serotonin: {
        borderColor: '$borderColor',
      },
      idle: {
        opacity: 0.9,
      },
      interactive: {
        cursor: 'pointer',
        hoverStyle: { borderColor: '$borderColorHover', backgroundColor: '$surfaceHover', y: -2 },
        pressStyle: { scale: 0.995, y: 0 },
        focusStyle: { outlineColor: '$accent', outlineWidth: 2, outlineStyle: 'solid', outlineOffset: 2 },
      },
    },
  } as const,
  defaultVariants: {
    variant: 'default',
  },
});

// De-emphasized relative to input values: smaller, muted, medium weight —
// supports the field it labels instead of competing with it.
export const Label = styled(TamaguiLabel, {
  name: 'AppLabel',
  fontSize: '$3',
  fontWeight: '500',
  color: '$muted',
});

export const Eyebrow = styled(Text, {
  name: 'Eyebrow',
  textTransform: 'uppercase',
  letterSpacing: 2,
  fontSize: '$2',
  fontWeight: '600',
  color: '$accent',
  backgroundColor: '$accentBackground',
  borderRadius: radius.pill,
  paddingHorizontal: '$3',
  paddingVertical: '$1',
  alignSelf: 'flex-start',
  marginBottom: '$2',
});

export const ScoreDisplay = styled(Text, {
  fontSize: 40,
  fontWeight: '700',
  color: '$accent',
  fontFamily: '$body',
  fontVariant: ['tabular-nums'],
});

export const H1 = styled(TamaguiH1, {
  fontWeight: '600',
  letterSpacing: '$9',
});

export const H2 = styled(TamaguiH2, {
  fontWeight: '600',
  letterSpacing: '$7',
});

export const H3 = styled(TamaguiH3, {
  fontWeight: '600',
  letterSpacing: '$6',
});

export { Text, YStack, XStack, Paragraph };
