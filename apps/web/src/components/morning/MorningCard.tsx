import { useMemo } from 'react';
import { BLOCK_DONE_FOCUS_MIN, addDaysToKey, localDateKey, morningStatus } from '@calendar/shared';
import { AppCard, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { useCalendarData } from '../../hooks/useCalendarData';
import { useMorningWindow } from '../../hooks/useMorningWindow';
import { StartFlexibleBlockButton } from './FlexibleBlockStarter';

// Today's flexible morning on the calendar and the dashboard (dynamic-study-blocks D13): the window,
// each block started with its real focus, and whether the morning is fulfilled (two blocks of 60+).

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function MorningCard({ withWeek = false }: { withWeek?: boolean }) {
  const morning = useMorningWindow();
  const { pomodoroSessions } = useCalendarData();

  // This week's mornings (Monday to today), for the dashboard.
  const week = useMemo(() => {
    const today = localDateKey(new Date());
    const dow = (new Date().getDay() + 6) % 7;
    const days = Array.from({ length: dow + 1 }, (_, i) => addDaysToKey(today, -dow + i));
    const statuses = days.map((d) => morningStatus(pomodoroSessions ?? [], d));
    return {
      fulfilled: statuses.filter((s) => s.fulfilled).length,
      withBlocks: statuses.filter((s) => s.started > 0).length,
    };
  }, [pomodoroSessions]);

  if (!morning.schedule || !morning.start || !morning.end) return null;
  const { status } = morning;

  return (
    <AppCard>
      <YStack gap="$2">
        <XStack justifyContent="space-between" alignItems="center" gap="$3" flexWrap="wrap">
          <YStack>
            <Text fontWeight="800">
              Mañana de estudio · {hhmm(morning.start)}-{hhmm(morning.end)}
            </Text>
            <Text color="$muted" fontSize="$2">
              {morning.schedule.label} · {status.done} de {status.target} bloques cumplidos
            </Text>
          </YStack>
          {status.fulfilled ? (
            <Text color="$accent" fontWeight="800">
              Mañana cumplida
            </Text>
          ) : null}
        </XStack>
        {status.blocks.map((block, i) => (
          <Text key={block.id ?? i} fontSize="$3" color={block.done ? '$accent' : '$color'}>
            Bloque {i + 1} {block.done ? '✓' : block.active ? '· en curso' : '·'}{' '}
            {block.focusMinutes} min de foco
            {!block.done && !block.active ? ` (se cumple con ${BLOCK_DONE_FOCUS_MIN})` : ''}
          </Text>
        ))}
        {morning.studyTask ? (
          <Paragraph margin={0} color="$muted" fontSize="$2">
            Sesión que toca: {morning.studyTask.title}
          </Paragraph>
        ) : null}
        {withWeek ? (
          <Text fontSize="$2" color="$muted">
            Esta semana: {week.fulfilled}{' '}
            {week.fulfilled === 1 ? 'mañana cumplida' : 'mañanas cumplidas'} de {week.withBlocks}{' '}
            con bloques.
          </Text>
        ) : null}
        <XStack>
          <StartFlexibleBlockButton />
        </XStack>
      </YStack>
    </AppCard>
  );
}
