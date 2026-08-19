import { useMemo } from 'react';
import { AppButton, AppCard, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { useNativeFieldStyle } from '../../hooks/useNativeFieldStyle';
import { useSchedules } from '../../hooks/useSchedules';
import { useTasks } from '../../hooks/useTasks';
import { isSameDay } from '../../lib/calendar/utils';
import { getTodayPomodoroSlots, minuteToISOForDate } from '../../lib/ritual/capacity';
import { minuteToTimeValue } from '../../lib/schedules/types';
import { taskToFormValues } from '../../lib/tasks/types';
import { StatusCard } from '../StatusCard';

export function MorningReview({ onComplete }: { onComplete: () => void }) {
  const { tasks, isLoading, isMutating, updateTask } = useTasks();
  const { schedules, isLoading: isLoadingSchedules } = useSchedules();
  const fieldStyle = useNativeFieldStyle();
  const selectStyle = { minHeight: 36, borderRadius: 8, padding: '0 10px', ...fieldStyle };

  const now = useMemo(() => new Date(), []);

  const leftoverTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          (task.status === 'PENDING' || task.status === 'IN_PROGRESS') &&
          (!task.scheduledAt || !isSameDay(new Date(task.scheduledAt), now)),
      ),
    [tasks, now],
  );

  const todaySlots = useMemo(() => getTodayPomodoroSlots(schedules, now), [schedules, now]);

  const assignedTodayCount = useMemo(
    () =>
      tasks
        .filter((task) => task.scheduledAt && isSameDay(new Date(task.scheduledAt), now))
        .reduce((sum, task) => sum + (task.estimatedPomodoros ?? 1), 0),
    [tasks, now],
  );

  const isOvercommitted = todaySlots.length > 0 && assignedTodayCount > todaySlots.length;

  async function handleAssign(taskId: string, minute: number) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    await updateTask(taskId, { ...taskToFormValues(task), scheduledAt: minuteToISOForDate(minute, now) });
  }

  if (isLoading || isLoadingSchedules) {
    return <StatusCard tone="loading" message="Cargando tareas..." />;
  }

  return (
    <YStack gap="$4">
      <AppCard>
        <YStack gap="$1">
          <Text fontWeight="700">Capacidad de hoy</Text>
          <Paragraph margin={0} color={isOvercommitted ? '$error' : '$muted'}>
            {assignedTodayCount}/{todaySlots.length || '?'} pomodoros de hoy asignados
            {todaySlots.length === 0 ? ' (sin horario de trabajo configurado hoy)' : ''}
          </Paragraph>
          {isOvercommitted ? (
            <Paragraph margin={0} color="$error" size="$2">
              Tienes mas tareas asignadas hoy que pomodoros disponibles -- considera posponer algo.
            </Paragraph>
          ) : null}
        </YStack>
      </AppCard>

      {leftoverTasks.length === 0 ? (
        <StatusCard tone="info" message="No hay pendientes de ayer ni tareas sin horario. Buen punto de partida." />
      ) : (
        <YStack gap="$3">
          <Text fontWeight="700">Dales un horario a estas tareas</Text>
          {leftoverTasks.map((task) => (
            <AppCard key={task.id}>
              <XStack justifyContent="space-between" alignItems="center" gap="$3" flexWrap="wrap">
                <YStack flex={1} minWidth={180}>
                  <Text fontWeight="700">{task.title}</Text>
                  <Text color="$muted" fontSize="$2">
                    {task.estimatedPomodoros ?? 1} pomodoro(s)
                    {task.scheduledAt ? ' - pendiente de ayer' : ' - sin horario'}
                  </Text>
                </YStack>
                <select
                  style={selectStyle}
                  value=""
                  disabled={isMutating || todaySlots.length === 0}
                  onChange={(event) => {
                    const minute = Number(event.target.value);
                    if (Number.isFinite(minute)) void handleAssign(task.id, minute);
                  }}
                >
                  <option value="" disabled>
                    {todaySlots.length === 0 ? 'Sin bloques hoy' : 'Elegir horario de hoy'}
                  </option>
                  {todaySlots.map((slot) => (
                    <option key={`${slot.scheduleId}-${slot.startMinute}`} value={slot.startMinute}>
                      {minuteToTimeValue(slot.startMinute)}
                    </option>
                  ))}
                </select>
              </XStack>
            </AppCard>
          ))}
        </YStack>
      )}

      <XStack justifyContent="flex-end">
        <AppButton variant="primary" onPress={onComplete}>
          Terminar revision matutina
        </AppButton>
      </XStack>
    </YStack>
  );
}
