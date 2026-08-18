import { AppButton, AppCard, H2, Paragraph, ScoreDisplay, Text, XStack, YStack } from '@calendar/ui';
import type { HabitWithScore } from '../../hooks/useHabits';
import { HABIT_TYPE_LABELS } from '../../lib/habits/labels';
import type { SyncHabitRecord, SyncJournalEntry } from '../../lib/habits/types';
import { HabitHeatmap } from './HabitHeatmap';
import { HabitJournal } from './HabitJournal';

interface HabitDetailProps {
  habit: HabitWithScore;
  records: SyncHabitRecord[];
  journalEntries: SyncJournalEntry[];
  isBusy: boolean;
  onBack: () => void;
  onEdit: () => void;
  onArchive: () => Promise<void>;
  onDelete: () => Promise<void>;
  onCellPress: (dateKey: string, existing: SyncHabitRecord | undefined) => void;
  onAddJournalEntry: (content: string) => Promise<void>;
  onDeleteJournalEntry: (entryId: string) => Promise<void>;
}

export function HabitDetail({
  habit,
  records,
  journalEntries,
  isBusy,
  onBack,
  onEdit,
  onArchive,
  onDelete,
  onCellPress,
  onAddJournalEntry,
  onDeleteJournalEntry,
}: HabitDetailProps) {
  async function handleDelete() {
    if (!window.confirm(`Eliminar el habito "${habit.title}"? Esta accion no se puede deshacer.`)) {
      return;
    }
    await onDelete();
  }

  return (
    <YStack gap="$4">
      <AppButton type="button" variant="ghost" alignSelf="flex-start" onPress={onBack}>
        {'< Volver'}
      </AppButton>

      <AppCard>
        <YStack gap="$4">
          <XStack justifyContent="space-between" alignItems="flex-start" gap="$3" flexWrap="wrap">
            <YStack gap="$1" flex={1} minWidth={180}>
              <XStack alignItems="center" gap="$2">
                <YStack width={12} height={12} borderRadius={999} backgroundColor={habit.color ?? '#4ee0a0'} />
                <H2 margin={0} fontSize="$6">
                  {habit.title}
                </H2>
              </XStack>
              <Text fontSize="$2" color="$muted">
                {HABIT_TYPE_LABELS[habit.type]} · meta: {habit.dailyGoalValue} {habit.dailyGoalUnit}/dia · {habit.targetDays} dias para consolidar
              </Text>
              {habit.description ? (
                <Paragraph color="$muted" margin={0}>
                  {habit.description}
                </Paragraph>
              ) : null}
            </YStack>

            <YStack alignItems="center">
              <ScoreDisplay>{Math.round(habit.score)}</ScoreDisplay>
              <Text fontSize="$1" color="$muted">
                score
              </Text>
            </YStack>
          </XStack>

          <YStack gap="$2">
            <Paragraph margin={0} fontWeight="600">
              Historial
            </Paragraph>
            <HabitHeatmap habit={habit} records={records} onCellPress={onCellPress} />
          </YStack>

          <XStack gap="$2" justifyContent="flex-end" flexWrap="wrap">
            <AppButton type="button" variant="ghost" disabled={isBusy} onPress={onEdit}>
              Editar
            </AppButton>
            <AppButton type="button" variant="ghost" disabled={isBusy} onPress={() => void onArchive()}>
              {habit.archived ? 'Reactivar' : 'Archivar'}
            </AppButton>
            <AppButton type="button" variant="danger" disabled={isBusy} onPress={() => void handleDelete()}>
              Eliminar
            </AppButton>
          </XStack>
        </YStack>
      </AppCard>

      <AppCard>
        <HabitJournal
          entries={journalEntries}
          isBusy={isBusy}
          onAdd={onAddJournalEntry}
          onDelete={onDeleteJournalEntry}
        />
      </AppCard>
    </YStack>
  );
}
