import { styled, Button as TamaguiButton, Card as TamaguiCard, Text, YStack, XStack, H1, H2, H3, Paragraph } from 'tamagui';
import { radius } from '../tokens';

export const AppButton = styled(TamaguiButton, {
  name: 'AppButton',
  borderRadius: radius[3],
  fontFamily: '$body',
  fontWeight: '600',
  cursor: 'pointer',
  animation: 'quick',
  variants: {
    variant: {
      primary: {
        backgroundColor: '$accent',
        color: '#12151b',
        hoverStyle: { opacity: 0.9 },
        pressStyle: { opacity: 0.85, scale: 0.98 },
      },
      ghost: {
        backgroundColor: 'transparent',
        color: '$color',
        borderWidth: 1,
        borderColor: '$borderColor',
        hoverStyle: { borderColor: '$borderColorHover' },
      },
      small: {
        backgroundColor: '$accentBackground',
        color: '$color',
        paddingHorizontal: '$3',
        paddingVertical: '$2',
        fontSize: '$3',
      },
      mood: {
        backgroundColor: '$accentBackground',
        color: '$color',
        fontWeight: '500',
        flex: 1,
        minWidth: 120,
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
  shadowColor: '$shadowColor',
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 8 },
  variants: {
    variant: {
      default: {},
      serotonin: {
        backgroundColor: '$surfaceRaised',
        borderColor: '$borderColorHover',
      },
      idle: {
        opacity: 0.9,
      },
    },
  } as const,
  defaultVariants: {
    variant: 'default',
  },
});

export const Eyebrow = styled(Text, {
  fontFamily: '$body',
  textTransform: 'uppercase',
  letterSpacing: 2,
  fontSize: '$2',
  fontWeight: '600',
  color: '$accent',
  marginBottom: '$2',
});

export const ScoreDisplay = styled(Text, {
  fontFamily: '$heading',
  fontSize: 40,
  fontWeight: '600',
  color: '$accent',
  fontVariant: ['tabular-nums'],
});

export { Text, YStack, XStack, H1, H2, H3, Paragraph };
