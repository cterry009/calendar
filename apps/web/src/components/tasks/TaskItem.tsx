import { useMemo, useState } from 'react';
import { AppButton, AppCard, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { Input } from 'tamagui';
import { TASK_DIFFICULTY_LABELS, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '../../lib/tasks/labels';
import type { SyncTaskRecord } from '../../lib/tasks/types';

interface TaskItemProps {
  task: SyncTaskRecord;
  isBusy: boolean;
  onEdit: (task: SyncTaskRecord) => void;
  onDelete: (task: SyncTaskRecord) => Promise<void>;
  onComplete: (task: SyncTaskRecord, actualMinutes: number) => Promise<void>;
  onStartPomodoro?: (task: SyncTaskRecord) => void;
}

interface MetaBadgeProps {
  text: string;
}

function MetaBadge({ text }: MetaBadgeProps) {
  return (
    <Text
      backgroundColor="rgba(255,255,255,0.08)"
      paddingHorizontal="$3"
      paddingVertical="$1"
      borderRadius="$10"
      fontSize="$2"
      color="$muted"
    >
      {text}
    </Text>
  );
}

export function TaskItem({ task, isBusy, onEdit, onDelete, onComplete, onStartPomodoro }: TaskItemProps) {
  const [showCompleteEditor, setShowCompleteEditor] = useState(false);
  const [actualMinutesInput, setActualMinutesInput] = useState(String(task.actualMinutes ?? task.estimatedMinutes));
  const [completeError, setCompleteError] = useState<string | null>(null);

  const scheduledAtLabel = useMemo(() => {
    if (!task.scheduledAt) return 'Sin programar';
    return new Date(task.scheduledAt).toLocaleString('es-ES');
  }, [task.scheduledAt]);

  async function handleDelete() {
    await onDelete(task);
  }

  async function handleComplete() {
    setCompleteError(null);
    const value = Number(actualMinutesInput);

    if (!Number.isInteger(value) || value < 0) {
      setCompleteError('Ingresa un numero entero valido para minutos reales.');
      return;
    }

    await onComplete(task, value);
    setShowCompleteEditor(false);
  }

  const isCompleted = task.status === 'COMPLETED';
  const canStartPomodoro = task.status === 'PENDING' || task.status === 'IN_PROGRESS';

  return (
    <AppCard>
      <YStack gap="$3">
        <XStack justifyContent="space-between" alignItems="flex-start" gap="$3" flexWrap="wrap">
          <YStack flex={1} minWidth={220}>
            <Paragraph size="$6" margin={0}>
              {task.title}
            </Paragraph>
            {task.description ? (
              <Paragraph color="$muted" margin={0}>
                {task.description}
              </Paragraph>
            ) : null}
          </YStack>

          <XStack gap="$2" flexWrap="wrap">
            <MetaBadge text={`Dificultad: ${TASK_DIFFICULTY_LABELS[task.difficulty]}`} />
            <MetaBadge text={`Prioridad: ${TASK_PRIORITY_LABELS[task.priority]}`} />
            <MetaBadge text={`Estado: ${TASK_STATUS_LABELS[task.status]}`} />
            <MetaBadge text={`Complejidad: ${task.complexity}/10`} />
          </XStack>
        </XStack>

        <XStack gap="$3" flexWrap="wrap">
          <MetaBadge text={`Programada: ${scheduledAtLabel}`} />
          <MetaBadge text={`Estimado: ${task.estimatedMinutes} min`} />
          {task.actualMinutes != null ? <MetaBadge text={`Real: ${task.actualMinutes} min`} /> : null}
          {task.category ? <MetaBadge text={`Categoria: ${task.category}`} /> : null}
        </XStack>

        {showCompleteEditor && !isCompleted ? (
          <YStack gap="$2">
            <Input
              id={`actual-minutes-${task.id}`}
              type="number"
              min={0}
              value={actualMinutesInput}
              onChangeText={setActualMinutesInput}
              placeholder="Minutos reales"
            />
            {completeError ? (
              <Paragraph color="$error" margin={0}>
                {completeError}
              </Paragraph>
            ) : null}
          </YStack>
        ) : null}

        <XStack gap="$2" justifyContent="flex-end" flexWrap="wrap">
          {onStartPomodoro && canStartPomodoro ? (
            <AppButton type="button" variant="ghost" disabled={isBusy} onPress={() => onStartPomodoro(task)}>
              Iniciar pomodoro
            </AppButton>
          ) : null}
          {!isCompleted ? (
            <AppButton
              type="button"
              variant={showCompleteEditor ? 'primary' : 'ghost'}
              disabled={isBusy}
              onPress={() => {
                if (showCompleteEditor) {
                  void handleComplete();
                } else {
                  setShowCompleteEditor(true);
                }
              }}
            >
              {showCompleteEditor ? 'Confirmar completada' : 'Completar'}
            </AppButton>
          ) : null}
          {!isCompleted ? (
            <AppButton type="button" variant="ghost" disabled={isBusy} onPress={() => onEdit(task)}>
              Editar
            </AppButton>
          ) : null}
          <AppButton type="button" variant="ghost" disabled={isBusy} onPress={() => void handleDelete()}>
            Eliminar
          </AppButton>
        </XStack>
      </YStack>
    </AppCard>
  );
}
