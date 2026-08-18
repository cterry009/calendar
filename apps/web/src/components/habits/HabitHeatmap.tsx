import { XStack, YStack } from '@calendar/ui';
import { habitCellColor } from '../../lib/habits/labels';
import { habitCellVisualState, lastNDateKeys } from '../../lib/habits/today';
import type { SyncHabit, SyncHabitRecord } from '../../lib/habits/types';

interface HabitHeatmapProps {
  habit: Pick<SyncHabit, 'id' | 'type' | 'dailyGoalValue' | 'dailyGoalExtraValue' | 'color'>;
  records: SyncHabitRecord[];
  weeks?: number;
  cellSize?: number;
  onCellPress?: (dateKey: string, existing: SyncHabitRecord | undefined) => void;
}

/** Sunday-aligned columns, like GitHub's contribution graph, so a habit's shape is recognizable at a glance. */
function buildWeekColumns(keys: string[]): (string | null)[][] {
  if (!keys.length) return [];
  const firstWeekday = new Date(`${keys[0]}T00:00:00.000Z`).getUTCDay();
  const padded: (string | null)[] = [...(Array(firstWeekday).fill(null) as null[]), ...keys];

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }
  return weeks;
}

export function HabitHeatmap({ habit, records, weeks = 18, cellSize = 13, onCellPress }: HabitHeatmapProps) {
  const baseColor = habit.color ?? '#4ee0a0';
  const keys = lastNDateKeys(weeks * 7);
  const columns = buildWeekColumns(keys);

  return (
    <XStack gap="$1" flexWrap="wrap">
      {columns.map((column, columnIndex) => (
        <YStack key={columnIndex} gap="$1">
          {column.map((key, rowIndex) =>
            key ? (
              <YStack
                key={key}
                width={cellSize}
                height={cellSize}
                borderRadius={3}
                backgroundColor={habitCellColor(habitCellVisualState(habit, records.find((r) => r.date.slice(0, 10) === key), key), baseColor)}
                cursor={onCellPress ? 'pointer' : 'default'}
                onPress={onCellPress ? () => onCellPress(key, records.find((r) => r.date.slice(0, 10) === key)) : undefined}
                title={key}
              />
            ) : (
              <YStack key={`empty-${rowIndex}`} width={cellSize} height={cellSize} />
            ),
          )}
        </YStack>
      ))}
    </XStack>
  );
}
