import { Text, YStack } from '@calendar/ui';
import { habitCellColor } from '../../lib/habits/labels';
import { habitCellVisualState, lastNDateKeys, todayKey } from '../../lib/habits/today';
import type { SyncHabit, SyncHabitRecord } from '../../lib/habits/types';

interface HabitDayCellStripProps {
  habit: Pick<SyncHabit, 'id' | 'type' | 'dailyGoalValue' | 'dailyGoalExtraValue' | 'color'>;
  records: SyncHabitRecord[];
  days?: number;
  cellSize?: number;
  onCellPress?: (dateKey: string, existing: SyncHabitRecord | undefined) => void;
}

/**
 * The mhabit-style tappable day strip: one small cell per recent day, colored by that day's
 * completion tier in the habit's own color. Tapping a past/today cell cycles it through the
 * quick states (empty -> done -> skipped -> empty) without opening the habit.
 */
export function HabitDayCellStrip({
  habit,
  records,
  days = 14,
  cellSize = 18,
  onCellPress,
}: HabitDayCellStripProps) {
  const baseColor = habit.color ?? '#4ee0a0';
  const keys = lastNDateKeys(days);
  const today = todayKey();

  return (
    <YStack flexDirection="row" gap="$1">
      {keys.map((key) => {
        const record = records.find((r) => r.date.slice(0, 10) === key);
        const state = habitCellVisualState(habit, record, key);
        const isFuture = key > today;

        return (
          <YStack
            key={key}
            width={cellSize}
            height={cellSize}
            borderRadius={4}
            backgroundColor={habitCellColor(state, baseColor)}
            borderWidth={key === today ? 1 : 0}
            borderColor="$color"
            cursor={isFuture ? 'default' : 'pointer'}
            onPress={isFuture ? undefined : () => onCellPress?.(key, record)}
            aria-label={`${key}: ${state}`}
            title={key}
          />
        );
      })}
      <Text fontSize="$1" color="$muted" marginLeft="$1" alignSelf="center">
        {days}d
      </Text>
    </YStack>
  );
}
