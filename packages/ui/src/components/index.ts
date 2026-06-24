import { styled, Button as TamaguiButton, Card as TamaguiCard, Text, YStack, XStack, H1, H2, H3, Paragraph } from 'tamagui';

export const AppButton = styled(TamaguiButton, {
  name: 'AppButton',
  borderRadius: '$3',
  fontWeight: '600',
  cursor: 'pointer',
  variants: {
    variant: {
      primary: {
        backgroundColor: '$accent',
        color: '#0a0f14',
        hoverStyle: { opacity: 0.9 },
        pressStyle: { opacity: 0.85 },
      },
      ghost: {
        backgroundColor: 'transparent',
        color: '$color',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
      },
      small: {
        backgroundColor: '$accentBackground',
        color: '$color',
        paddingHorizontal: '$3',
        paddingVertical: '$2',
        fontSize: '$3',
      },
      mood: {
        backgroundColor: 'rgba(255,255,255,0.06)',
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
  borderRadius: '$5',
  padding: '$6',
  elevate: false,
  variants: {
    variant: {
      default: {},
      serotonin: {
        borderColor: '$borderColor',
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
  textTransform: 'uppercase',
  letterSpacing: 2,
  fontSize: '$2',
  color: '$accent',
  marginBottom: '$2',
});

export const ScoreDisplay = styled(Text, {
  fontSize: 40,
  fontWeight: '700',
  color: '$accent',
});

export { Text, YStack, XStack, H1, H2, H3, Paragraph };
