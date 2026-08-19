import type { PomodoroStreakResult } from '@calendar/shared';
import { AppCard, Flame, Paragraph, Text, XStack, YStack } from '@calendar/ui';

interface PomodoroStreakCardProps {
  streak: PomodoroStreakResult;
}

function graceMessage(streak: PomodoroStreakResult): string | null {
  if (streak.graceDaysUsed === 0) {
    return null;
  }
  return streak.graceDaysUsed === 1
    ? 'Se perdono 1 dia con un token de gracia -- la racha sigue en pie.'
    : `Se perdonaron ${streak.graceDaysUsed} dias con tokens de gracia -- la racha sigue en pie.`;
}

export function PomodoroStreakCard({ streak }: PomodoroStreakCardProps) {
  const hasStreak = streak.currentStreak > 0;
  const grace = graceMessage(streak);

  return (
    <AppCard aria-label="Racha de pomodoros">
      <XStack justifyContent="space-between" alignItems="center" gap="$4" flexWrap="wrap">
        <XStack alignItems="center" gap="$3">
          <Flame size={32} color={hasStreak ? '$accent' : '$muted'} />
          <YStack gap={0}>
            <Text fontSize={32} fontWeight="800" lineHeight={36}>
              {streak.currentStreak}
            </Text>
            <Text color="$muted" fontSize="$2">
              {streak.currentStreak === 1 ? 'dia seguido' : 'dias seguidos'}
            </Text>
          </YStack>
        </XStack>

        <YStack alignItems="flex-end" gap="$1">
          <Text fontSize="$2" color="$muted">
            Tokens de gracia
          </Text>
          <XStack gap="$1" aria-label={`${streak.graceDaysRemaining} de ${streak.graceDaysTotal} tokens de gracia disponibles`}>
            {Array.from({ length: streak.graceDaysTotal }).map((_, index) => (
              <YStack
                key={index}
                width={10}
                height={10}
                borderRadius={999}
                backgroundColor={index < streak.graceDaysRemaining ? '$accent' : 'rgba(255,255,255,0.15)'}
              />
            ))}
          </XStack>
        </YStack>
      </XStack>

      <Paragraph margin={0} marginTop="$3" color={streak.isActiveToday ? '$success' : '$muted'} size="$2">
        {streak.isActiveToday
          ? 'Ya completaste un pomodoro hoy. Racha protegida.'
          : hasStreak
            ? 'Todavia no completaste un pomodoro hoy -- termina uno para mantener la racha.'
            : 'Completa un pomodoro para empezar una racha.'}
      </Paragraph>

      {grace ? (
        <Paragraph margin={0} marginTop="$1" color="$muted" size="$2">
          {grace}
        </Paragraph>
      ) : null}
    </AppCard>
  );
}
