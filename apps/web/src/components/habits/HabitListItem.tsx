import { AppCard, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import type { HabitWithScore } from '../../hooks/useHabits';
import { HABIT_TYPE_LABELS } from '../../lib/habits/labels';
import type { HabitCheckInValues, SyncHabitRecord } from '../../lib/habits/types';
import { HabitDayCellStrip } from './HabitDayCellStrip';

interface HabitListItemProps {
  habit: HabitWithScore;
  records: SyncHabitRecord[];
  onOpenDetail: () => void;
  onCellPress: (values: HabitCheckInValues, existing: SyncHabitRecord | undefined) => void;
}

export function HabitListItem({ habit, records, onOpenDetail, onCellPress }: HabitListItemProps) {
  function handleCellPress(dateKey: string, existing: SyncHabitRecord | undefined) {
    // Cycle: nothing -> done at goal -> skipped -> nothing, mirroring mhabit's inline tap-to-toggle.
    if (!existing) {
      onCellPress({ date: dateKey, value: habit.dailyGoalValue, status: 'DONE' }, existing);
      return;
    }
    if (existing.status === 'DONE') {
      onCellPress({ date: dateKey, value: 0, status: 'SKIPPED' }, existing);
      return;
    }
    onCellPress({ date: dateKey, value: 0, status: 'DONE' }, existing);
  }

  return (
    <AppCard variant="interactive" onPress={onOpenDetail}>
      <XStack justifyContent="space-between" alignItems="center" gap="$3" flexWrap="wrap">
        <YStack gap="$1" flex={1} minWidth={160}>
          <XStack alignItems="center" gap="$2">
            <YStack width={10} height={10} borderRadius={999} backgroundColor={habit.color ?? '#4ee0a0'} />
            <Paragraph size="$5" margin={0} color={habit.archived ? '$muted' : undefined}>
              {habit.title}
            </Paragraph>
          </XStack>
          <Text fontSize="$2" color="$muted">
            {HABIT_TYPE_LABELS[habit.type]} · score {Math.round(habit.score)}
          </Text>
        </YStack>

        <YStack onPress={(event: { stopPropagation: () => void }) => event.stopPropagation()}>
          <HabitDayCellStrip habit={habit} records={records} onCellPress={handleCellPress} />
        </YStack>
      </XStack>
    </AppCard>
  );
}
