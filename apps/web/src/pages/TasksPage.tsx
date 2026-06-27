import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppButton, AppCard, Eyebrow, H1, Paragraph, XStack, YStack } from '@calendar/ui';
import { TaskForm } from '../components/tasks/TaskForm';
import { TaskList } from '../components/tasks/TaskList';
import { useTasks } from '../hooks/useTasks';
import { TASK_DIFFICULTY_FILTER_LABELS } from '../lib/tasks/labels';
import { TASK_DIFFICULTIES, type SyncTaskRecord, type TaskDifficultyFilter, type TaskFormValues } from '../lib/tasks/types';

const DIFFICULTY_FILTERS: TaskDifficultyFilter[] = ['ALL', ...TASK_DIFFICULTIES];

export function TasksPage() {
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
    createTask,
    updateTask,
    deleteTask,
    completeTask,
  } = useTasks();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTask, setEditingTask] = useState<SyncTaskRecord | null>(null);

  async function handleCreate(values: TaskFormValues) {
    await createTask(values);
    setShowCreateForm(false);
  }

  async function handleUpdate(values: TaskFormValues) {
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
    <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$7" gap="$5">
      <XStack justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap="$4">
        <YStack maxWidth={760} data-tutorial="tasks-header">
          <Eyebrow>Productividad</Eyebrow>
          <H1 marginTop={0} marginBottom="$2">
            Tareas
          </H1>
          <Paragraph color="$muted" margin={0}>
            Crea, edita y completa tareas con dificultad, complejidad y seguimiento de minutos reales.
          </Paragraph>
        </YStack>

        <XStack gap="$2" flexWrap="wrap">
          <AppButton type="button" variant="ghost" onPress={() => navigate('/pomodoro')}>
            Pomodoro
          </AppButton>
          <AppButton type="button" variant="ghost" onPress={() => navigate('/calendar')}>
            Calendario
          </AppButton>
          <AppButton type="button" variant="ghost" onPress={() => navigate('/')}>
            Inicio
          </AppButton>
        </XStack>
      </XStack>

      <AppCard>
        <YStack gap="$3">
          <Paragraph margin={0}>Filtrar por dificultad</Paragraph>
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
          <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$2">
            <AppButton
              type="button"
              variant={showCreateForm ? 'ghost' : 'primary'}
              onPress={() => {
                setEditingTask(null);
                setShowCreateForm((value) => !value);
              }}
            >
              {showCreateForm ? 'Cancelar nueva tarea' : 'Nueva tarea'}
            </AppButton>

            <AppButton type="button" variant="ghost" onPress={() => void refetch()} disabled={isLoading || isMutating}>
              {isLoading ? 'Actualizando...' : 'Refrescar'}
            </AppButton>
          </XStack>
        </YStack>
      </AppCard>

      {error ? (
        <AppCard>
          <Paragraph color="$error" margin={0}>
            {error}
          </Paragraph>
        </AppCard>
      ) : null}

      {showCreateForm ? (
        <TaskForm
          mode="create"
          isSubmitting={isMutating}
          onSubmit={handleCreate}
          onCancel={() => setShowCreateForm(false)}
        />
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
        <AppCard>
          <Paragraph margin={0}>Cargando tareas...</Paragraph>
        </AppCard>
      ) : (
        <TaskList
          tasks={filteredTasks}
          isBusy={isMutating}
          emptyMessage="No hay tareas con este filtro."
          onEdit={(task) => {
            setShowCreateForm(false);
            setEditingTask(task);
          }}
          onDelete={handleDelete}
          onComplete={completeTask}
          onStartPomodoro={(task) => {
            navigate(`/pomodoro?taskId=${encodeURIComponent(task.id)}`);
          }}
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
