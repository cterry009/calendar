import { AppCard, Paragraph, Text, YStack } from '@calendar/ui';

interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  tone?: 'accent' | 'neutral' | 'danger';
}

const TONE_COLORS: Record<NonNullable<MetricCardProps['tone']>, string> = {
  accent: '$accent',
  neutral: '$muted',
  danger: '$error',
};

export function MetricCard({ title, value, subtitle, tone = 'accent' }: MetricCardProps) {
  return (
    <AppCard flex={1} minWidth={220}>
      <YStack gap="$2">
        <Paragraph color="$muted" margin={0}>
          {title}
        </Paragraph>
        <Text fontSize="$10" fontWeight="700" color={TONE_COLORS[tone]}>
          {value}
        </Text>
        <Paragraph color="$muted" margin={0}>
          {subtitle}
        </Paragraph>
      </YStack>
    </AppCard>
  );
}
