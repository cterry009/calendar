import { useMemo, useState } from 'react';
import { AppButton, AppCard, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { useTasks } from '../../hooks/useTasks';
import { isSameDay } from '../../lib/calendar/utils';
import { taskToFormValues } from '../../lib/tasks/types';
import { StatusCard } from '../StatusCard';

interface Props {
  initialReflection: string;
  onComplete: (reflection: string) => void;
}

const TEXTAREA_STYLE = {
  minHeight: 80,
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.24)',
  background: 'rgba(0,0,0,0.25)',
  color: 'white',
  padding: '10px 12px',
  fontFamily: 'inherit',
  fontSize: 14,
  resize: 'vertical' as const,
};

export function EveningShutdown({ initialReflection, onComplete }: Props) {
  const { tasks, isLoading, isMutating, updateTask, completeTask } = useTasks();
  const [reflection, setReflection] = useState(initialReflection);

  const now = useMemo(() => new Date(), []);

  const todayTasks = useMemo(
    () => tasks.filter((task) => task.scheduledAt && isSameDay(new Date(task.scheduledAt), now)),
    [tasks, now],
  );

  const completedTasks = todayTasks.filter((task) => task.status === 'COMPLETED');
  const pendingTasks = todayTasks.filter((task) => task.status === 'PENDING' || task.status === 'IN_PROGRESS');

  async function handleCompleteNow(taskId: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    await completeTask(task, task.estimatedMinutes);
  }

  async function handlePostpone(taskId: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    await updateTask(taskId, { ...taskToFormValues(task), scheduledAt: null });
  }

  if (isLoading) {
    return <StatusCard tone="loading" message="Cargando tareas de hoy..." />;
  }

  return (
    <YStack gap="$4">
      <AppCard>
        <Paragraph margin={0} color="$muted">
          {completedTasks.length} completadas hoy - {pendingTasks.length} sin terminar
        </Paragraph>
      </AppCard>

      {pendingTasks.length === 0 ? (
        <StatusCard tone="info" message="No quedan tareas de hoy sin terminar." />
      ) : (
        <YStack gap="$3">
          <Text fontWeight="700">Tareas de hoy sin terminar</Text>
          {pendingTasks.map((task) => (
            <AppCard key={task.id}>
              <XStack justifyContent="space-between" alignItems="center" gap="$3" flexWrap="wrap">
                <Text flex={1} minWidth={160} fontWeight="700">
                  {task.title}
                </Text>
                <XStack gap="$2">
                  <AppButton variant="small" disabled={isMutating} onPress={() => void handleCompleteNow(task.id)}>
                    Completar ahora
                  </AppButton>
                  <AppButton variant="ghost" disabled={isMutating} onPress={() => void handlePostpone(task.id)}>
                    Postergar a manana
                  </AppButton>
                </XStack>
              </XStack>
            </AppCard>
          ))}
        </YStack>
      )}

      <YStack gap="$2">
        <Text fontWeight="700">Reflexion del dia (opcional)</Text>
        <textarea
          style={TEXTAREA_STYLE}
          value={reflection}
          onChange={(event) => setReflection(event.target.value)}
          placeholder="Como te fue hoy? Que harias distinto manana?"
        />
      </YStack>

      <XStack justifyContent="flex-end">
        <AppButton variant="primary" onPress={() => onComplete(reflection)}>
          Terminar cierre nocturno
        </AppButton>
      </XStack>
    </YStack>
  );
}
