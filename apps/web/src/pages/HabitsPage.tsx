import { useMemo, useState } from 'react';
import { AppButton, AppCard, Paragraph, XStack, YStack } from '@calendar/ui';
import { HabitDetail } from '../components/habits/HabitDetail';
import { HabitForm } from '../components/habits/HabitForm';
import { HabitTable } from '../components/habits/HabitTable';
import { HabitTodayCard } from '../components/habits/HabitTodayCard';
import { PageHeader } from '../components/PageHeader';
import { StatusCard } from '../components/StatusCard';
import { useHabits, type HabitWithScore } from '../hooks/useHabits';
import type { SyncHabit } from '../lib/calendar/types';
import { todayKey } from '../lib/habits/today';
import type { HabitCheckInValues } from '../lib/habits/types';

type HabitsTab = 'today' | 'all';

export function HabitsPage() {
  const {
    habits,
    records,
    isLoading,
    isMutating,
    error,
    syncedAt,
    refetch,
    createHabit,
    updateHabit,
    archiveHabit,
    deleteHabit,
    checkIn,
    deleteCheckIn,
    recordsForHabit,
    addJournalEntry,
    deleteJournalEntry,
    journalEntriesForHabit,
  } = useHabits();

  const [tab, setTab] = useState<HabitsTab>('today');
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingHabit, setEditingHabit] = useState<SyncHabit | null>(null);

  const activeHabits = useMemo(() => habits.filter((habit) => !habit.archived), [habits]);
  const selectedHabit = useMemo<HabitWithScore | null>(
    () => habits.find((habit) => habit.id === selectedHabitId) ?? null,
    [habits, selectedHabitId],
  );

  async function handleCreate(values: Parameters<typeof createHabit>[0]) {
    await createHabit(values);
    setShowCreateForm(false);
  }

  async function handleUpdate(values: Parameters<typeof updateHabit>[1]) {
    if (!editingHabit) return;
    await updateHabit(editingHabit.id, values);
    setEditingHabit(null);
  }

  async function handleCheckIn(habitId: string, values: HabitCheckInValues) {
    await checkIn(habitId, values);
  }

  async function handleSkip(habitId: string, reason: string) {
    await checkIn(habitId, { date: todayKey(), value: 0, status: 'SKIPPED' }, reason);
  }

  if (editingHabit || (showCreateForm && !selectedHabit)) {
    return (
      <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$7" gap="$5">
        <PageHeader eyebrow="Habitos" title={editingHabit ? 'Editar habito' : 'Nuevo habito'} />
        <HabitForm
          mode={editingHabit ? 'edit' : 'create'}
          initialHabit={editingHabit ?? undefined}
          isSubmitting={isMutating}
          onSubmit={editingHabit ? handleUpdate : handleCreate}
          onCancel={() => {
            setEditingHabit(null);
            setShowCreateForm(false);
          }}
        />
      </YStack>
    );
  }

  if (selectedHabit) {
    return (
      <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$7" gap="$5">
        <PageHeader eyebrow="Habitos" title={selectedHabit.title} />
        <HabitDetail
          habit={selectedHabit}
          records={recordsForHabit(selectedHabit.id)}
          journalEntries={journalEntriesForHabit(selectedHabit.id)}
          isBusy={isMutating}
          onBack={() => setSelectedHabitId(null)}
          onEdit={() => setEditingHabit(selectedHabit)}
          onArchive={() => archiveHabit(selectedHabit.id, !selectedHabit.archived)}
          onDelete={async () => {
            await deleteHabit(selectedHabit.id);
            setSelectedHabitId(null);
          }}
          onCellPress={(dateKey, existing) => {
            if (existing) {
              void deleteCheckIn(existing.id);
              return;
            }
            void handleCheckIn(selectedHabit.id, {
              date: dateKey,
              value: selectedHabit.dailyGoalValue,
              status: 'DONE',
            });
          }}
          onAddJournalEntry={(content) => addJournalEntry(selectedHabit.id, content)}
          onDeleteJournalEntry={deleteJournalEntry}
        />
      </YStack>
    );
  }

  return (
    <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$7" gap="$5">
      <PageHeader
        eyebrow="Habitos"
        title="Habitos"
        description="Construi o dejá habitos con un score que crece con la constancia, no con rachas perfectas. Un dia salteado explicitamente no te penaliza; un dia sin registrar, si."
        tutorialId="habits-header"
        actions={
          <AppButton type="button" variant="primary" onPress={() => setShowCreateForm(true)}>
            Nuevo habito
          </AppButton>
        }
      />

      <XStack gap="$2">
        <AppButton type="button" variant={tab === 'today' ? 'primary' : 'ghost'} onPress={() => setTab('today')}>
          Hoy
        </AppButton>
        <AppButton type="button" variant={tab === 'all' ? 'primary' : 'ghost'} onPress={() => setTab('all')}>
          Todos
        </AppButton>
        <AppButton type="button" variant="ghost" onPress={() => void refetch()} disabled={isLoading || isMutating}>
          {isLoading ? 'Actualizando...' : 'Refrescar'}
        </AppButton>
      </XStack>

      {error ? <StatusCard tone="error" message={error} /> : null}

      {isLoading ? (
        <StatusCard tone="loading" message="Cargando habitos..." />
      ) : activeHabits.length === 0 ? (
        <AppCard data-tutorial="habits-list">
          <YStack gap="$2" alignItems="center" paddingVertical="$5">
            <Paragraph margin={0}>Todavia no tenes habitos.</Paragraph>
            <AppButton type="button" variant="primary" onPress={() => setShowCreateForm(true)}>
              Crear el primero
            </AppButton>
          </YStack>
        </AppCard>
      ) : tab === 'today' ? (
        <YStack gap="$3" data-tutorial="habits-list">
          {activeHabits.map((habit) => (
            <HabitTodayCard
              key={habit.id}
              habit={habit}
              records={recordsForHabit(habit.id)}
              isBusy={isMutating}
              onCheckIn={(values) => handleCheckIn(habit.id, values)}
              onSkip={(reason) => handleSkip(habit.id, reason)}
              onRemoveCheckIn={deleteCheckIn}
              onOpenDetail={() => setSelectedHabitId(habit.id)}
            />
          ))}
        </YStack>
      ) : (
        <HabitTable
          habits={habits}
          records={records}
          onOpenDetail={(habitId) => setSelectedHabitId(habitId)}
          onCellPress={(habitId, values) => void handleCheckIn(habitId, values)}
        />
      )}

      {syncedAt ? (
        <Paragraph size="$2" color="$muted" margin={0}>
          Ultima sincronizacion: {new Date(syncedAt).toLocaleString('es-ES')}
        </Paragraph>
      ) : null}
    </YStack>
  );
}
