import { AppButton, AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import type { HabitWithScore } from '../../hooks/useHabits';
import { HABIT_TYPE_LABELS, withAlpha } from '../../lib/habits/labels';
import { daysBetween, sampleScoreHistory, todayKey } from '../../lib/habits/today';
import type { SyncHabitRecord, SyncJournalEntry } from '../../lib/habits/types';
import { HabitHeatmap } from './HabitHeatmap';
import { HabitJournal } from './HabitJournal';
import { HabitRing } from './HabitRing';
import { HabitScoreHistoryChart } from './HabitScoreHistoryChart';

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

interface StatProps {
  label: string;
  value: string;
}

function Stat({ label, value }: StatProps) {
  return (
    <YStack alignItems="center" flex={1}>
      <Text fontSize="$2" color="$muted">
        {label}
      </Text>
      <Text fontSize="$6" fontWeight="700" fontVariant={['tabular-nums']}>
        {value}
      </Text>
    </YStack>
  );
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
  const baseColor = habit.color ?? '#4ee0a0';
  const daysSinceStart = Math.max(0, daysBetween(habit.createdAt.slice(0, 10), todayKey()));
  const scoreHistory = sampleScoreHistory(habit, records);

  async function handleDelete() {
    if (!window.confirm(`Eliminar el habito "${habit.title}"? Esta accion no se puede deshacer.`)) {
      return;
    }
    await onDelete();
  }

  return (
    <YStack gap="$4">
      <XStack justifyContent="space-between" alignItems="center">
        <AppButton type="button" variant="ghost" onPress={onBack} color={baseColor}>
          {'< Volver'}
        </AppButton>
        <XStack gap="$2">
          <AppButton type="button" variant="ghost" disabled={isBusy} onPress={onEdit} color={baseColor}>
            Editar
          </AppButton>
          <AppButton type="button" variant="ghost" disabled={isBusy} onPress={() => void onArchive()} color={baseColor}>
            {habit.archived ? 'Reactivar' : 'Archivar'}
          </AppButton>
          <AppButton type="button" variant="danger" disabled={isBusy} onPress={() => void handleDelete()}>
            Eliminar
          </AppButton>
        </XStack>
      </XStack>

      <AppCard>
        <YStack gap="$4">
          <XStack gap="$4" alignItems="center" flexWrap="wrap">
            <HabitRing color={baseColor} progress={habit.score} size={72} strokeWidth={6} />
            <YStack gap="$1" flex={1} minWidth={200}>
              <H2 margin={0} fontSize="$7" color={baseColor}>
                {habit.title}
              </H2>
              <Text fontSize="$2" color="$muted">
                {HABIT_TYPE_LABELS[habit.type]} · meta: {habit.dailyGoalValue} {habit.dailyGoalUnit}/dia
              </Text>
              <Paragraph margin={0} color="$muted">
                Score actual: {Math.round(habit.score)}, y han pasado {daysSinceStart} dia{daysSinceStart === 1 ? '' : 's'} desde que empezaste.
              </Paragraph>
              {habit.description ? (
                <Paragraph color="$muted" margin={0}>
                  {habit.description}
                </Paragraph>
              ) : null}
            </YStack>
          </XStack>

          <YStack gap="$2">
            <Paragraph margin={0} fontWeight="600">
              Historial
            </Paragraph>
            <HabitHeatmap habit={habit} records={records} onCellPress={onCellPress} />
          </YStack>

          <XStack
            borderTopWidth={1}
            borderBottomWidth={1}
            borderColor="$borderColor"
            paddingVertical="$3"
          >
            <Stat label="Meta" value={`${habit.dailyGoalValue} ${habit.dailyGoalUnit}`} />
            <Stat label="Dias para consolidar" value={`${habit.targetDays}d`} />
            <Stat label="Registros" value={String(records.length)} />
          </XStack>

          <YStack gap="$2">
            <Paragraph margin={0} fontWeight="600">
              Score en el tiempo
            </Paragraph>
            <YStack backgroundColor={withAlpha(baseColor, 0.05)} borderRadius="$3" padding="$2">
              <HabitScoreHistoryChart points={scoreHistory} color={baseColor} />
            </YStack>
          </YStack>
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
