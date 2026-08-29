import { AppButton, Text, XStack, YStack } from '@calendar/ui';
import { confirmDestructiveAction } from '../../lib/confirmAction';
import { HABIT_TYPE_LABELS } from '../../lib/habits/labels';
import { findRecordForDate, todayKey } from '../../lib/habits/today';
import type { SyncHabitRecord } from '../../lib/habits/types';
import type { HabitWithScore } from '../../hooks/useHabits';

interface HabitRowProps {
  habit: HabitWithScore;
  records: SyncHabitRecord[];
  isBusy: boolean;
  onCheckIn: (status: 'DONE' | 'SKIPPED') => void;
  onDelete: () => void;
}

// Mirrors the shape of BlockListEntryRow.tsx (delete-with-confirm pattern) plus a Si/No check-in
// pair for today -- there's no calendar-grid cell here (apps/web/src/components/habits/* renders
// a full month grid, out of scope for this port, see labels.ts/today.ts's doc comments), just
// today's status, which is also exactly what the notification action buttons drive (task 11.6).
export function HabitRow({ habit, records, isBusy, onCheckIn, onDelete }: HabitRowProps) {
  const todayRecord = findRecordForDate(records, habit.id, todayKey());

  function confirmDelete() {
    confirmDestructiveAction(
      'Eliminar habito',
      `Eliminar "${habit.title}"? Esta accion no se puede deshacer.`,
      'Eliminar',
      onDelete,
    );
  }

  return (
    <YStack gap="$2" paddingVertical="$3" borderBottomWidth={1} borderBottomColor="$borderColor">
      <XStack alignItems="center" justifyContent="space-between" gap="$2">
        <YStack flex={1} gap="$1">
          <Text fontWeight="600" fontSize="$4">
            {habit.title}
          </Text>
          <Text color="$muted" fontSize="$2">
            {HABIT_TYPE_LABELS[habit.type]} - puntaje {Math.round(habit.score)}
          </Text>
        </YStack>
        <AppButton variant="ghost" paddingHorizontal="$2" onPress={confirmDelete} disabled={isBusy}>
          <Text color="$danger" fontSize="$2">
            Quitar
          </Text>
        </AppButton>
      </XStack>

      <XStack gap="$2">
        <AppButton
          flex={1}
          variant={todayRecord?.status === 'DONE' ? 'primary' : 'ghost'}
          onPress={() => onCheckIn('DONE')}
          disabled={isBusy}
        >
          Si, hoy
        </AppButton>
        <AppButton
          flex={1}
          variant={todayRecord?.status === 'SKIPPED' ? 'primary' : 'ghost'}
          onPress={() => onCheckIn('SKIPPED')}
          disabled={isBusy}
        >
          No, hoy
        </AppButton>
      </XStack>
    </YStack>
  );
}
