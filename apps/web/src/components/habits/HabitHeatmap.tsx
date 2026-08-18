import { Text, XStack, YStack } from '@calendar/ui';
import { habitCellColor, type HabitCellVisualState } from '../../lib/habits/labels';
import { habitCellVisualState, lastNDateKeys } from '../../lib/habits/today';
import type { SyncHabit, SyncHabitRecord } from '../../lib/habits/types';

interface HabitHeatmapProps {
  habit: Pick<SyncHabit, 'id' | 'type' | 'dailyGoalValue' | 'dailyGoalExtraValue' | 'color'>;
  records: SyncHabitRecord[];
  weeks?: number;
  cellSize?: number;
  onCellPress?: (dateKey: string, existing: SyncHabitRecord | undefined) => void;
}

const WEEKDAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const MONTH_LABELS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const LEGEND_TIERS: HabitCellVisualState[] = ['empty', 'partial', 'auto', 'done', 'exceeded'];

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

/** One label per calendar month, positioned at the first column that enters that month. */
function monthLabelForColumn(column: (string | null)[], previousColumn: (string | null)[] | undefined): string | null {
  const firstKey = column.find((key): key is string => key !== null);
  if (!firstKey) return null;
  const month = Number(firstKey.slice(5, 7)) - 1;

  const previousFirstKey = previousColumn?.find((key): key is string => key !== null);
  const previousMonth = previousFirstKey ? Number(previousFirstKey.slice(5, 7)) - 1 : null;
  if (month === previousMonth) return null;

  return MONTH_LABELS[month];
}

export function HabitHeatmap({ habit, records, weeks = 18, cellSize = 13, onCellPress }: HabitHeatmapProps) {
  const baseColor = habit.color ?? '#4ee0a0';
  const keys = lastNDateKeys(weeks * 7);
  const columns = buildWeekColumns(keys);

  return (
    <YStack gap="$2">
      <XStack alignItems="center" gap="$2" flexWrap="wrap">
        <Text fontSize="$1" color="$muted">
          Incompleto
        </Text>
        {LEGEND_TIERS.map((tier) => (
          <YStack key={tier} width={cellSize} height={cellSize} borderRadius={3} backgroundColor={habitCellColor(tier, baseColor)} />
        ))}
        <Text fontSize="$1" color="$muted">
          Superado
        </Text>
      </XStack>

      <XStack gap="$3">
        <XStack gap="$1">
          {columns.map((column, columnIndex) => (
            <YStack key={columnIndex} gap="$1">
              {column.map((key, rowIndex) =>
                key ? (
                  <YStack
                    key={key}
                    width={cellSize}
                    height={cellSize}
                    borderRadius={3}
                    backgroundColor={habitCellColor(
                      habitCellVisualState(habit, records.find((r) => r.date.slice(0, 10) === key), key),
                      baseColor,
                    )}
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

        <YStack gap="$1">
          {WEEKDAY_LABELS.map((label, index) => (
            <Text key={index} fontSize="$1" color="$muted" height={cellSize} lineHeight={cellSize}>
              {label}
            </Text>
          ))}
        </YStack>
      </XStack>

      <XStack gap="$1">
        {columns.map((column, index) => (
          <YStack key={index} width={cellSize} alignItems="center">
            <Text fontSize="$1" color="$muted">
              {monthLabelForColumn(column, columns[index - 1]) ?? ''}
            </Text>
          </YStack>
        ))}
      </XStack>
    </YStack>
  );
}
