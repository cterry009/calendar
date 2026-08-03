import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppButton, AppCard, H2, Paragraph, XStack, YStack } from '@calendar/ui';
import { TaskForm } from './TaskForm';
import { TaskList } from './TaskList';
import { useTasks } from '../../hooks/useTasks';
import { TASK_DIFFICULTY_FILTER_LABELS } from '../../lib/tasks/labels';
import { TASK_DIFFICULTIES, type SyncTaskRecord, type TaskDifficultyFilter } from '../../lib/tasks/types';

const DIFFICULTY_FILTERS: TaskDifficultyFilter[] = ['ALL', ...TASK_DIFFICULTIES];

/** Task list, filters, edit and complete -- creation lives in the calendar's quick-add
 * (per work block), not here, so this stays focused on managing what's already there. */
export function TaskManager() {
  const navigate = useNavigate();
  const {
    filteredTasks,
    difficultyFilter,
    setDifficultyFilter,
    isLoading,
    isMutating,
    error,
    syncedAt,
    refetch,
    updateTask,
    deleteTask,
    completeTask,
  } = useTasks();

  const [editingTask, setEditingTask] = useState<SyncTaskRecord | null>(null);

  async function handleUpdate(values: Parameters<typeof updateTask>[1]) {
    if (!editingTask) return;
    await updateTask(editingTask.id, values);
    setEditingTask(null);
  }

  async function handleDelete(task: SyncTaskRecord) {
    await deleteTask(task.id);
    if (editingTask?.id === task.id) {
      setEditingTask(null);
    }
  }

  return (
    <AppCard>
      <YStack gap="$4">
        <YStack gap="$1">
          <H2 margin={0} fontSize="$6">
            Tareas
          </H2>
          <Paragraph color="$muted" margin={0}>
            Se crean directamente desde un bloque de trabajo en el calendario. Aca podes filtrar, editar y
            completarlas.
          </Paragraph>
        </YStack>

        <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$2">
          <XStack gap="$2" flexWrap="wrap">
            {DIFFICULTY_FILTERS.map((filter) => (
              <AppButton
                key={filter}
                type="button"
                variant={difficultyFilter === filter ? 'primary' : 'ghost'}
                onPress={() => setDifficultyFilter(filter)}
              >
                {TASK_DIFFICULTY_FILTER_LABELS[filter]}
              </AppButton>
            ))}
          </XStack>

          <AppButton type="button" variant="ghost" onPress={() => void refetch()} disabled={isLoading || isMutating}>
            {isLoading ? 'Actualizando...' : 'Refrescar'}
          </AppButton>
        </XStack>

        {error ? (
          <Paragraph color="$error" margin={0}>
            {error}
          </Paragraph>
        ) : null}

        {editingTask ? (
          <TaskForm
            mode="edit"
            initialTask={editingTask}
            isSubmitting={isMutating}
            onSubmit={handleUpdate}
            onCancel={() => setEditingTask(null)}
          />
        ) : null}

        {isLoading ? (
          <Paragraph margin={0}>Cargando tareas...</Paragraph>
        ) : (
          <TaskList
            tasks={filteredTasks}
            isBusy={isMutating}
            emptyMessage="No hay tareas todavia. Agregalas desde un bloque de trabajo en el calendario."
            onEdit={setEditingTask}
            onDelete={handleDelete}
            onComplete={completeTask}
            onStartPomodoro={(task) => navigate(`/pomodoro?taskId=${encodeURIComponent(task.id)}`)}
          />
        )}

        {syncedAt ? (
          <Paragraph size="$2" color="$muted" margin={0}>
            Ultima sincronizacion: {new Date(syncedAt).toLocaleString('es-ES')}
          </Paragraph>
        ) : null}
      </YStack>
    </AppCard>
  );
}
