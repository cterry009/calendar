import { useMemo } from 'react';
import { BLOCK_DONE_FOCUS_MIN, addDaysToKey, localDateKey, morningStatus } from '@calendar/shared';
import { AppCard, Text, XStack, YStack } from '@calendar/ui';
import { usePomodoro } from '../../context/PomodoroContext';
import { useCalendarData } from '../../hooks/useCalendarData';
import { useDayBlocks } from '../../hooks/useMorningWindow';
import { focusView } from '../../lib/focusView/store';
import { AppButton } from '@calendar/ui';

// Today's flexible blocks on the calendar, the pomodoro page and the dashboard (dynamic-study-blocks
// D27, revision 2): the four suggestions with their state, the day's minimum (two done morning blocks,
// 45+ min of focus each) and "Empezar" on each one not started.

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function MorningCard({ withWeek = false }: { withWeek?: boolean }) {
  const day = useDayBlocks();
  const { session } = usePomodoro();
  const { pomodoroSessions } = useCalendarData();

  // This week's days with the minimum met (Monday to today), for the dashboard.
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

  if (!day.suggestions.length) return null;
  const blocksOf = (scheduleId: string) =>
    [...day.morning.blocks, ...day.afternoon.blocks].filter((b) => b.scheduleId === scheduleId);

  return (
    <AppCard>
      <YStack gap="$2">
        <XStack justifyContent="space-between" alignItems="center" gap="$3" flexWrap="wrap">
          <YStack>
            <Text fontWeight="800">Bloques de hoy</Text>
            <Text color="$muted" fontSize="$2">
              Mínimo del día: {day.morning.done} de {day.morning.target} bloques de la mañana (cada
              uno con {BLOCK_DONE_FOCUS_MIN} min de foco)
            </Text>
          </YStack>
          {day.morning.fulfilled ? (
            <Text color="$accent" fontWeight="800">
              Mínimo cumplido
            </Text>
          ) : null}
        </XStack>
        {day.suggestions.map((s) => {
          const blocks = blocksOf(s.schedule.id);
          const focus = blocks.reduce((sum, b) => sum + b.focusMinutes, 0);
          const done = blocks.some((b) => b.done);
          const running = blocks.some((b) => b.active);
          return (
            <XStack
              key={s.schedule.id}
              alignItems="center"
              justifyContent="space-between"
              gap="$2"
              flexWrap="wrap"
            >
              <YStack flex={1} minWidth={180}>
                <Text fontSize="$3" fontWeight="700" color={done ? '$accent' : '$color'}>
                  {hhmm(s.start)} · {s.schedule.label}
                  {done ? ' ✓' : ''}
                </Text>
                <Text fontSize="$2" color="$muted">
                  {running
                    ? `En curso · ${focus} min de foco`
                    : s.started
                      ? `${focus} min de foco`
                      : s.studyTask
                        ? s.studyTask.title
                        : 'Sin empezar'}
                </Text>
              </YStack>
              {!s.started && !session?.active ? (
                <AppButton variant="ghost" onPress={() => focusView.openStarter(s.schedule.id)}>
                  Empezar
                </AppButton>
              ) : null}
            </XStack>
          );
        })}
        {withWeek ? (
          <Text fontSize="$2" color="$muted">
            Esta semana: {week.fulfilled}{' '}
            {week.fulfilled === 1 ? 'día con el mínimo' : 'días con el mínimo'} de {week.withBlocks}{' '}
            con bloques.
          </Text>
        ) : null}
      </YStack>
    </AppCard>
  );
}
