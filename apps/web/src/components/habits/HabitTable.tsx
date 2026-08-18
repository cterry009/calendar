import { useState } from 'react';
import { AppButton, Text, XStack, YStack } from '@calendar/ui';
import type { HabitWithScore } from '../../hooks/useHabits';
import { habitCellColor } from '../../lib/habits/labels';
import { habitCellVisualState, lastNDateKeys, shiftDateKey, todayKey } from '../../lib/habits/today';
import type { HabitCheckInValues, SyncHabitRecord } from '../../lib/habits/types';
import { HabitRing } from './HabitRing';

interface HabitTableProps {
  habits: HabitWithScore[];
  records: SyncHabitRecord[];
  visibleDays?: number;
  onOpenDetail: (habitId: string) => void;
  onCellPress: (habitId: string, values: HabitCheckInValues, existing: SyncHabitRecord | undefined) => void;
}

const WEEKDAY_SHORT = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];

function formatColumnLabel(key: string): { day: string; weekday: string } {
  const date = new Date(`${key}T00:00:00.000Z`);
  return {
    day: `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
    weekday: WEEKDAY_SHORT[date.getUTCDay()],
  };
}

function cellLabel(
  state: ReturnType<typeof habitCellVisualState>,
  record: SyncHabitRecord | undefined,
): string {
  switch (state) {
    case 'future':
      return '';
    case 'empty':
      return '?';
    case 'skipped':
      return '✕';
    case 'done':
    case 'auto':
      return '✓';
    case 'exceeded':
    case 'partial':
      return record ? String(record.value) : '';
  }
}

/**
 * The mhabit-style list: rows are habits, columns are actual calendar dates, cells show a
 * checkmark/number/x/? -- text-dense like a spreadsheet, instead of a strip of color blocks.
 */
export function HabitTable({ habits, records, visibleDays = 6, onOpenDetail, onCellPress }: HabitTableProps) {
  const [windowEnd, setWindowEnd] = useState(todayKey());
  const keys = lastNDateKeys(visibleDays, windowEnd);
  const today = todayKey();

  function handleCellPress(habit: HabitWithScore, key: string, existing: SyncHabitRecord | undefined) {
    if (!existing) {
      onCellPress(habit.id, { date: key, value: habit.dailyGoalValue, status: 'DONE' }, existing);
      return;
    }
    if (existing.status === 'DONE') {
      onCellPress(habit.id, { date: key, value: 0, status: 'SKIPPED' }, existing);
      return;
    }
    onCellPress(habit.id, { date: key, value: 0, status: 'DONE' }, existing);
  }

  return (
    <YStack gap="$2">
      <XStack alignItems="center" gap="$2">
        <AppButton
          type="button"
          variant="ghost"
          paddingHorizontal="$2"
          onPress={() => setWindowEnd((current) => shiftDateKey(current, -visibleDays))}
          aria-label="Dias anteriores"
        >
          {'<'}
        </AppButton>

        <XStack flex={1} justifyContent="flex-end" gap="$3">
          {keys.map((key) => {
            const { day, weekday } = formatColumnLabel(key);
            return (
              <YStack key={key} width={36} alignItems="center">
                <Text fontSize="$1" color={key === today ? '$accent' : '$muted'} textTransform="uppercase">
                  {weekday}
                </Text>
                <Text fontSize="$2" color={key === today ? '$accent' : undefined} fontWeight={key === today ? '700' : undefined}>
                  {day}
                </Text>
              </YStack>
            );
          })}
        </XStack>

        <AppButton
          type="button"
          variant="ghost"
          paddingHorizontal="$2"
          disabled={windowEnd >= today}
          onPress={() => setWindowEnd((current) => shiftDateKey(current, visibleDays))}
          aria-label="Dias siguientes"
        >
          {'>'}
        </AppButton>
      </XStack>

      <YStack gap="$1">
        {habits.map((habit) => (
          <XStack key={habit.id} alignItems="center" gap="$2" paddingVertical="$1">
            <XStack
              flex={1}
              minWidth={0}
              alignItems="center"
              gap="$2"
              cursor="pointer"
              onPress={() => onOpenDetail(habit.id)}
            >
              <HabitRing color={habit.color ?? '#4ee0a0'} progress={habit.score} size={28} strokeWidth={3} />
              <Text
                numberOfLines={1}
                color={habit.archived ? '$muted' : undefined}
                flexShrink={1}
              >
                {habit.title}
              </Text>
            </XStack>

            <XStack gap="$3">
              {keys.map((key) => {
                const record = records.find((r) => r.habitId === habit.id && r.date.slice(0, 10) === key);
                const state = habitCellVisualState(habit, record, key);
                const isFuture = state === 'future';
                return (
                  <YStack
                    key={key}
                    width={36}
                    height={28}
                    alignItems="center"
                    justifyContent="center"
                    borderRadius="$2"
                    backgroundColor={state === 'empty' || state === 'future' ? 'transparent' : habitCellColor(state, habit.color ?? '#4ee0a0')}
                    cursor={isFuture ? 'default' : 'pointer'}
                    onPress={isFuture ? undefined : () => handleCellPress(habit, key, record)}
                  >
                    <Text fontSize="$2" color={state === 'empty' ? '$muted' : undefined}>
                      {cellLabel(state, record)}
                    </Text>
                  </YStack>
                );
              })}
            </XStack>
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}
