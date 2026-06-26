import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppButton, AppCard, Eyebrow, H1, Paragraph, XStack, YStack } from '@calendar/ui';
import { PomodoroTimer } from '../components/pomodoro/PomodoroTimer';
import { usePomodoro } from '../hooks/usePomodoro';
import { useTasks } from '../hooks/useTasks';

export function PomodoroPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryTaskId = searchParams.get('taskId');

  const pomodoro = usePomodoro();
  const tasksData = useTasks();

  const availableTasks = useMemo(
    () => tasksData.tasks.filter((task) => task.status === 'PENDING' || task.status === 'IN_PROGRESS'),
    [tasksData.tasks],
  );

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (queryTaskId && availableTasks.some((task) => task.id === queryTaskId)) {
      setSelectedTaskId(queryTaskId);
      return;
    }

    if (pomodoro.session?.taskId && availableTasks.some((task) => task.id === pomodoro.session?.taskId)) {
      setSelectedTaskId(pomodoro.session.taskId);
      return;
    }

    setSelectedTaskId(null);
  }, [availableTasks, pomodoro.session?.taskId, queryTaskId]);

  const linkedTaskName = useMemo(() => {
    const currentTaskId = pomodoro.session?.taskId ?? selectedTaskId;
    if (!currentTaskId) {
      return null;
    }

    return tasksData.tasks.find((task) => task.id === currentTaskId)?.title ?? 'Tarea no encontrada';
  }, [pomodoro.session?.taskId, selectedTaskId, tasksData.tasks]);

  return (
    <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$7" gap="$5">
      <XStack justifyContent="space-between" alignItems="flex-start" gap="$4" flexWrap="wrap">
        <YStack maxWidth={760}>
          <Eyebrow>Productividad</Eyebrow>
          <H1 marginTop={0} marginBottom="$2">
            Temporizador pomodoro
          </H1>
          <Paragraph color="$muted" margin={0}>
            Vincula tus ciclos de enfoque y descanso a una tarea para mejorar trazabilidad y consistencia.
          </Paragraph>
        </YStack>

        <XStack gap="$2" flexWrap="wrap">
          <AppButton variant="ghost" onPress={() => navigate('/tasks')}>
            Tareas
          </AppButton>
          <AppButton variant="ghost" onPress={() => navigate('/calendar')}>
            Calendario
          </AppButton>
          <AppButton variant="ghost" onPress={() => navigate('/')}>
            Inicio
          </AppButton>
        </XStack>
      </XStack>

      <AppCard>
        <YStack gap="$3">
          <Paragraph margin={0}>Selecciona tarea (pendiente/en progreso)</Paragraph>
          {tasksData.isLoading ? (
            <Paragraph color="$muted" margin={0}>
              Cargando tareas...
            </Paragraph>
          ) : (
            <select
              value={selectedTaskId ?? ''}
              onChange={(event) => {
                setSelectedTaskId(event.target.value || null);
              }}
              style={{
                minHeight: 42,
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.24)',
                background: 'rgba(0,0,0,0.25)',
                color: 'white',
                padding: '0 12px',
              }}
            >
              <option value="">Sin vincular tarea</option>
              {availableTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          )}
          {tasksData.error ? (
            <Paragraph color="$error" margin={0}>
              {tasksData.error}
            </Paragraph>
          ) : null}
        </YStack>
      </AppCard>

      <PomodoroTimer
        session={pomodoro.session}
        linkedTaskName={linkedTaskName}
        selectedTaskId={selectedTaskId}
        config={pomodoro.config}
        remainingSeconds={pomodoro.remainingSeconds}
        phaseDurationMinutes={pomodoro.phaseDurationMinutes}
        isBlocking={pomodoro.isBlocking}
        notificationsEnabled={pomodoro.notificationsEnabled}
        isLoading={pomodoro.isLoading}
        isMutating={pomodoro.isMutating}
        error={pomodoro.error}
        syncedAt={pomodoro.syncedAt}
        onRefetch={pomodoro.refetch}
        onStart={pomodoro.start}
        onCancel={pomodoro.cancel}
        onReset={pomodoro.reset}
        onUpdateConfig={pomodoro.updateConfig}
        onToggleNotifications={pomodoro.toggleNotifications}
      />
    </YStack>
  );
}
