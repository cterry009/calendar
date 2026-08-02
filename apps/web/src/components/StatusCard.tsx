import { AppCard, Paragraph, XStack, YStack } from '@calendar/ui';
import { Spinner } from './Spinner';

interface StatusCardProps {
  tone?: 'loading' | 'error' | 'info' | 'muted';
  message: string;
  detail?: string;
}

const MESSAGE_COLOR: Record<NonNullable<StatusCardProps['tone']>, string | undefined> = {
  loading: undefined,
  error: '$error',
  info: undefined,
  muted: '$muted',
};

export function StatusCard({ tone = 'info', message, detail }: StatusCardProps) {
  return (
    <AppCard>
      <YStack gap={detail ? '$2' : 0}>
        <XStack gap="$3" alignItems="center">
          {tone === 'loading' ? <Spinner /> : null}
          <Paragraph margin={0} color={MESSAGE_COLOR[tone]}>
            {message}
          </Paragraph>
        </XStack>
        {detail ? (
          <Paragraph color="$muted" margin={0}>
            {detail}
          </Paragraph>
        ) : null}
      </YStack>
    </AppCard>
  );
}
