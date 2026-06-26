import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppButton, AppCard, H2, Paragraph, XStack, YStack } from '@calendar/ui';
import { Label, TextArea } from 'tamagui';
import { TASK_DIFFICULTY_LABELS, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '../../lib/tasks/labels';
import { TASK_DIFFICULTIES, TASK_PRIORITIES, TASK_STATUSES, type SyncTaskRecord, type TaskFormValues } from '../../lib/tasks/types';
import { FormField } from './FormField';

interface TaskFormProps {
  mode: 'create' | 'edit';
  initialTask?: SyncTaskRecord;
  isSubmitting: boolean;
  onSubmit: (values: TaskFormValues) => Promise<void>;
  onCancel: () => void;
}

interface TaskFormDraft {
  title: string;
  description: string;
  scheduledAt: string;
  estimatedMinutes: string;
  actualMinutes: string;
  difficulty: TaskFormValues['difficulty'];
  complexity: string;
  priority: TaskFormValues['priority'];
  category: string;
  status: TaskFormValues['status'];
}

function toDateTimeLocal(isoDate: string | null): string {
  if (!isoDate) return '';

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultDraft(task?: SyncTaskRecord): TaskFormDraft {
  return {
    title: task?.title ?? '',
    description: task?.description ?? '',
    scheduledAt: toDateTimeLocal(task?.scheduledAt ?? null),
    estimatedMinutes: String(task?.estimatedMinutes ?? 30),
    actualMinutes: task?.actualMinutes == null ? '' : String(task.actualMinutes),
    difficulty: task?.difficulty ?? 'MEDIUM',
    complexity: String(task?.complexity ?? 5),
    priority: task?.priority ?? 'MEDIUM',
    category: task?.category ?? '',
    status: task?.status ?? 'PENDING',
  };
}

export function TaskForm({ mode, initialTask, isSubmitting, onSubmit, onCancel }: TaskFormProps) {
  const [draft, setDraft] = useState<TaskFormDraft>(() => defaultDraft(initialTask));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(defaultDraft(initialTask));
    setError(null);
  }, [initialTask, mode]);

  const title = useMemo(
    () => (mode === 'create' ? 'Nueva tarea' : `Editar: ${initialTask?.title ?? 'tarea'}`),
    [initialTask?.title, mode],
  );

  function setField<Key extends keyof TaskFormDraft>(field: Key, value: TaskFormDraft[Key]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedTitle = draft.title.trim();
    const estimatedMinutes = Number(draft.estimatedMinutes);
    const complexity = Number(draft.complexity);
    const actualMinutesRaw = draft.actualMinutes.trim();
    const actualMinutes = actualMinutesRaw ? Number(actualMinutesRaw) : null;

    if (!trimmedTitle) {
      setError('El titulo es obligatorio.');
      return;
    }

    if (!Number.isInteger(estimatedMinutes) || estimatedMinutes < 1) {
      setError('La estimacion debe ser un entero mayor o igual a 1.');
      return;
    }

    if (!Number.isInteger(complexity) || complexity < 1 || complexity > 10) {
      setError('La complejidad debe estar entre 1 y 10.');
      return;
    }

    if (actualMinutes !== null && (!Number.isInteger(actualMinutes) || actualMinutes < 0)) {
      setError('Los minutos reales deben ser un entero mayor o igual a 0.');
      return;
    }

    const scheduledAt = draft.scheduledAt ? new Date(draft.scheduledAt).toISOString() : null;

    await onSubmit({
      title: trimmedTitle,
      description: draft.description.trim() || null,
      scheduledAt,
      estimatedMinutes,
      actualMinutes,
      difficulty: draft.difficulty,
      complexity,
      priority: draft.priority,
      category: draft.category.trim() || null,
      status: draft.status,
    });
  }

  return (
    <AppCard>
      <YStack gap="$4" tag="form" onSubmit={handleSubmit}>
        <H2 margin={0} fontSize="$6">
          {title}
        </H2>

        <FormField
          id="task-title"
          label="Titulo"
          placeholder="Ej. Preparar roadmap semanal"
          value={draft.title}
          onChangeText={(value: string) => setField('title', value)}
          required
        />

        <YStack gap="$2">
          <Label htmlFor="task-description">Descripcion</Label>
          <TextArea
            id="task-description"
            value={draft.description}
            onChangeText={(value: string) => setField('description', value)}
            placeholder="Detalles de la tarea"
            minHeight={90}
          />
        </YStack>

        <FormField
          id="task-scheduled-at"
          label="Programada para"
          type="datetime-local"
          value={draft.scheduledAt}
          onChangeText={(value: string) => setField('scheduledAt', value)}
        />

        <XStack gap="$3" flexWrap="wrap">
          <YStack minWidth={180} flex={1}>
            <FormField
              id="task-estimated-minutes"
              label="Minutos estimados"
              type="number"
              value={draft.estimatedMinutes}
              onChangeText={(value: string) => setField('estimatedMinutes', value)}
              min={1}
              required
            />
          </YStack>
          <YStack minWidth={180} flex={1}>
            <FormField
              id="task-actual-minutes"
              label="Minutos reales"
              type="number"
              value={draft.actualMinutes}
              onChangeText={(value: string) => setField('actualMinutes', value)}
              min={0}
            />
          </YStack>
          <YStack minWidth={180} flex={1}>
            <FormField
              id="task-complexity"
              label="Complejidad (1-10)"
              type="number"
              value={draft.complexity}
              onChangeText={(value: string) => setField('complexity', value)}
              min={1}
              max={10}
              required
            />
          </YStack>
        </XStack>

        <FormField
          id="task-category"
          label="Categoria"
          placeholder="Ej. Trabajo, Estudio, Personal"
          value={draft.category}
          onChangeText={(value: string) => setField('category', value)}
        />

        <YStack gap="$2">
          <Paragraph margin={0}>Dificultad</Paragraph>
          <XStack gap="$2" flexWrap="wrap">
            {TASK_DIFFICULTIES.map((difficulty) => (
              <AppButton
                key={difficulty}
                type="button"
                variant={draft.difficulty === difficulty ? 'primary' : 'ghost'}
                onPress={() => setField('difficulty', difficulty)}
              >
                {TASK_DIFFICULTY_LABELS[difficulty]}
              </AppButton>
            ))}
          </XStack>
        </YStack>

        <YStack gap="$2">
          <Paragraph margin={0}>Prioridad</Paragraph>
          <XStack gap="$2" flexWrap="wrap">
            {TASK_PRIORITIES.map((priority) => (
              <AppButton
                key={priority}
                type="button"
                variant={draft.priority === priority ? 'primary' : 'ghost'}
                onPress={() => setField('priority', priority)}
              >
                {TASK_PRIORITY_LABELS[priority]}
              </AppButton>
            ))}
          </XStack>
        </YStack>

        <YStack gap="$2">
          <Paragraph margin={0}>Estado</Paragraph>
          <XStack gap="$2" flexWrap="wrap">
            {TASK_STATUSES.map((status) => (
              <AppButton
                key={status}
                type="button"
                variant={draft.status === status ? 'primary' : 'ghost'}
                onPress={() => setField('status', status)}
              >
                {TASK_STATUS_LABELS[status]}
              </AppButton>
            ))}
          </XStack>
        </YStack>

        {error ? (
          <Paragraph color="$error" margin={0}>
            {error}
          </Paragraph>
        ) : null}

        <XStack gap="$3" justifyContent="flex-end" flexWrap="wrap">
          <AppButton type="button" variant="ghost" onPress={onCancel} disabled={isSubmitting}>
            Cancelar
          </AppButton>
          <AppButton type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : mode === 'create' ? 'Crear tarea' : 'Guardar cambios'}
          </AppButton>
        </XStack>
      </YStack>
    </AppCard>
  );
}

