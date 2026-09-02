import { Text, XStack, YStack } from '@calendar/ui';
import { findRecordForDate, todayKey } from '../../lib/habits/today';
import type { SyncHabitRecord } from '../../lib/habits/types';
import type { HabitWithScore } from '../../hooks/useHabits';

interface HabitChecklistRowProps {
  habit: HabitWithScore;
  records: SyncHabitRecord[];
  isBusy: boolean;
  onComplete: () => void;
}

// Home-screen counterpart to TaskRow.tsx (same tap-the-circle-to-complete shape) -- the full
// Si/No pair with delete lives on HabitRow.tsx (habits.tsx), this is just "did I do it today,"
// which is also the one action the habit reminder notification's action buttons drive (task 11.6).
export function HabitChecklistRow({ habit, records, isBusy, onComplete }: HabitChecklistRowProps) {
  const todayRecord = findRecordForDate(records, habit.id, todayKey());
  const isDone = todayRecord?.status === 'DONE';

  return (
    <XStack alignItems="center" gap="$3" paddingVertical="$2">
      <YStack
        width={22}
        height={22}
        borderRadius={999}
        borderWidth={1.5}
        borderColor={isDone ? '$success' : '$borderColor'}
        backgroundColor={isDone ? '$success' : 'transparent'}
        alignItems="center"
        justifyContent="center"
        onPress={isDone || isBusy ? undefined : onComplete}
        flexShrink={0}
      >
        {isDone ? (
          <Text fontSize={13} color="#0a1c13">
            {'✓'}
          </Text>
        ) : null}
      </YStack>

      <Text flex={1} fontSize="$3" textDecorationLine={isDone ? 'line-through' : 'none'} color={isDone ? '$muted' : '$color'}>
        {habit.title}
      </Text>
    </XStack>
  );
}
