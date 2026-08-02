import { styled, Button as TamaguiButton, Card as TamaguiCard, Text, YStack, XStack, H1 as TamaguiH1, H2 as TamaguiH2, H3 as TamaguiH3, Paragraph } from 'tamagui';

export const AppButton = styled(TamaguiButton, {
  name: 'AppButton',
  borderRadius: '$3',
  fontWeight: '600',
  cursor: 'pointer',
  animation: 'quick',
  focusStyle: { outlineColor: '$accent', outlineWidth: 2, outlineStyle: 'solid', outlineOffset: 2 },
  pressStyle: { scale: 0.98 },
  variants: {
    variant: {
      primary: {
        backgroundColor: '$accent',
        color: '#0a0f14',
        hoverStyle: { backgroundColor: '$accent', opacity: 0.9 },
        pressStyle: { backgroundColor: '$accent', opacity: 0.85, scale: 0.98 },
      },
      ghost: {
        backgroundColor: 'transparent',
        color: '$color',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        hoverStyle: { borderColor: '$accent', backgroundColor: 'rgba(255,255,255,0.04)' },
        pressStyle: { backgroundColor: 'rgba(255,255,255,0.08)', scale: 0.98 },
      },
      small: {
        backgroundColor: '$accentBackground',
        color: '$color',
        paddingHorizontal: '$3',
        paddingVertical: '$2',
        fontSize: '$3',
        hoverStyle: { backgroundColor: '$accentBackground', opacity: 0.85 },
        pressStyle: { backgroundColor: '$accentBackground', opacity: 0.75, scale: 0.98 },
      },
      mood: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        color: '$color',
        fontWeight: '500',
        flex: 1,
        minWidth: 120,
        hoverStyle: { backgroundColor: 'rgba(255,255,255,0.1)' },
        pressStyle: { backgroundColor: 'rgba(255,255,255,0.14)', scale: 0.98 },
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
  borderRadius: '$5',
  padding: '$6',
  elevate: false,
  animation: 'quick',
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
        hoverStyle: { borderColor: '$borderColorHover', backgroundColor: '$surfaceHover' },
        pressStyle: { scale: 0.995 },
      },
    },
  } as const,
  defaultVariants: {
    variant: 'default',
  },
});

export const Eyebrow = styled(Text, {
  textTransform: 'uppercase',
  letterSpacing: 2,
  fontSize: '$2',
  fontWeight: '600',
  color: '$accent',
  marginBottom: '$2',
});

export const ScoreDisplay = styled(Text, {
  fontSize: 40,
  fontWeight: '700',
  color: '$accent',
  fontFamily: '$body',
  fontVariantNumeric: 'tabular-nums',
});

export const H1 = styled(TamaguiH1, {
  fontWeight: '700',
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
