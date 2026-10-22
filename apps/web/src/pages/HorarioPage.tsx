import { useEffect, useMemo, useState } from 'react';
import {
  isMondayKey,
  isPlanCategory,
  localDateKey,
  needsWeekdayUpdate,
  nextMondayKey,
  PLAN_CATEGORY_INFO,
  PLAN_WEEKS,
  phaseForWeek,
  planWeekOf,
  planWeekStart,
  weekProgress,
} from '@calendar/shared';
import { AppButton, AppCard, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { PageHeader } from '../components/PageHeader';
import { StatusCard } from '../components/StatusCard';
import { useSync } from '../context/SyncContext';
import { useCalendarData } from '../hooks/useCalendarData';
import { usePlan } from '../hooks/usePlan';
import { useSchedules } from '../hooks/useSchedules';
import { useTasks } from '../hooks/useTasks';
import { importTimetable, syncMilestoneTasks } from '../lib/plan/importTimetable';
import { saveStudyPlan } from '../lib/plan/sync';
import { applyWeekday } from '../lib/plan/morningWindow';

// Horario 2026-10-19: load the timetable, pick the start Monday, and follow the plan -- the week's
// phase, pomodoros by category, "cortar tramo" uses, and the milestones.

function weekLabel(start: string): string {
  const [y, m, d] = start.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export function HorarioPage() {
  const { plan, exceptions, isLoading, refetch } = usePlan();
  const { schedules, refetch: refetchSchedules } = useSchedules();
  const { tasks, completeTask, refetch: refetchTasks } = useTasks();
  const calendar = useCalendarData();
  const { pomodoroSessions } = calendar;
  const { notifyEntityChanged } = useSync();
  const [startInput, setStartInput] = useState(() => nextMondayKey(new Date()));
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Once the plan is loaded, the date field edits its start date.
  useEffect(() => {
    if (plan) setStartInput(plan.startDate);
  }, [plan?.startDate]);

  const today = localDateKey(new Date());
  const week = plan ? planWeekOf(plan, today) : 0;
  // Before the start, show week 1; after the end, the last one.
  const shownWeek = plan ? Math.min(Math.max(week, 1), plan.weeks) : 1;
  const progress = useMemo(
    () => (plan ? weekProgress(pomodoroSessions, schedules, exceptions, planWeekStart(plan, shownWeek)) : null),
    [plan, pomodoroSessions, schedules, exceptions, shownWeek],
  );
  const oldWorkBlocks = schedules.filter((s) => s.kind === 'WORK' && !s.category);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      notifyEntityChanged('schedules');
      notifyEntityChanged('studyPlan');
      notifyEntityChanged('tasks');
      notifyEntityChanged('habits');
      await Promise.all([refetch(), refetchSchedules(), refetchTasks()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  function validStart(): boolean {
    if (!isMondayKey(startInput)) {
      setError('La semana 1 tiene que empezar un lunes.');
      return false;
    }
    return true;
  }

  if (isLoading) return <StatusCard tone="muted" message="Cargando el horario..." />;

  if (!plan) {
    return (
      <YStack gap="$4">
        <PageHeader eyebrow="Horario" title="Cargar el horario" description="Plantilla semanal, 14 semanas en 3 fases, hitos y secuencias de pomodoros." />
        <AppCard>
          <YStack gap="$3">
            <XStack gap="$2" alignItems="center">
              <Text>Semana 1 empieza el lunes</Text>
              <input type="date" value={startInput} onChange={(e) => setStartInput(e.target.value)} />
            </XStack>
            <Paragraph margin={0} color="$muted">
              Lunes a viernes: mañana 09:00-13:00 y tarde 14:00-18:00, con dos bloques sugeridos cada una que empiezas tú y
              duran de 60 a 120 min según tu diagnóstico; almuerzo 13:00-14:00. Sábado: 09:00-10:30 y 11:00-12:30.
            </Paragraph>
            {confirming ? (
              <YStack gap="$2">
                <Text color="$warning">
                  Se van a borrar tus {oldWorkBlocks.length} bloques de trabajo actuales y se crean los del horario. ¿Seguir?
                </Text>
                <XStack gap="$2">
                  <AppButton
                    variant="primary"
                    disabled={busy}
                    onPress={() => void run(() => importTimetable({ startDate: startInput, schedules, tasks, habits: calendar.habits }))}
                  >
                    Sí, cargar el horario
                  </AppButton>
                  <AppButton variant="ghost" disabled={busy} onPress={() => setConfirming(false)}>
                    Cancelar
                  </AppButton>
                </XStack>
              </YStack>
            ) : (
              <AppButton variant="primary" alignSelf="flex-start" onPress={() => validStart() && setConfirming(true)}>
                Cargar horario
              </AppButton>
            )}
            {error ? <Text color="$error">{error}</Text> : null}
          </YStack>
        </AppCard>
      </YStack>
    );
  }

  const phase = phaseForWeek(plan, shownWeek);
  const milestones = tasks
    .filter((t) => t.clientId?.startsWith('hito:') && !t.deletedAt)
    .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''));

  return (
    <YStack gap="$4">
      <PageHeader
        eyebrow="Horario"
        title={week < 1 ? `Empieza el ${weekLabel(plan.startDate)}` : week > plan.weeks ? 'Plan terminado' : `Semana ${week} de ${plan.weeks}`}
        description={phase?.nombre}
      />

      {needsWeekdayUpdate(schedules) ? (
        // dynamic-study-blocks D30: an existing timetable's weekday becomes the flexible one in place.
        <AppCard>
          <YStack gap="$2">
            <Text fontWeight="700">Nueva jornada (2026-10-22)</Text>
            <Paragraph margin={0} color="$muted">
              Lunes a viernes pasan a dos ventanas, 09:00-13:00 y 14:00-18:00, con dos bloques sugeridos cada una (09:00, 11:00,
              14:00 y 16:00) que empiezan cuando los inicias. Antes de cada pomodoro das tu motivación y concentración (0-100): el
              bloque dura de 60 a 120 min y se ajusta ±10 con cada pomodoro. Almuerzo a las 13:00. El sábado no cambia.
            </Paragraph>
            <AppButton variant="primary" alignSelf="flex-start" disabled={busy} onPress={() => void run(async () => void (await applyWeekday(schedules)))}>
              Actualizar la jornada
            </AppButton>
            {error ? <Text color="$error">{error}</Text> : null}
          </YStack>
        </AppCard>
      ) : null}

      <AppCard>
        <YStack gap="$2">
          <Text fontWeight="700">
            Semana {shownWeek} ({weekLabel(planWeekStart(plan, shownWeek))}): pomodoros por categoría
          </Text>
          {progress && Object.keys(progress.pomodorosByCategory).length ? (
            Object.entries(progress.pomodorosByCategory).map(([category, count]) => (
              <XStack key={category} gap="$2" alignItems="center">
                <YStack
                  width={10}
                  height={10}
                  borderRadius={5}
                  backgroundColor={isPlanCategory(category) ? PLAN_CATEGORY_INFO[category].color : '$muted'}
                />
                <Text flex={1}>{isPlanCategory(category) ? PLAN_CATEGORY_INFO[category].name : category}</Text>
                <Text fontWeight="700">{count}</Text>
              </XStack>
            ))
          ) : (
            <Paragraph margin={0} color="$muted">
              Todavía no hay pomodoros completados esta semana.
            </Paragraph>
          )}
          <Text color="$muted" fontSize="$2">
            «Cortar tramo» usado esta semana: {progress?.cuts ?? 0} {progress && progress.cuts >= 3 ? '· quizá los tramos de 40 son largos' : ''}
          </Text>
        </YStack>
      </AppCard>

      <AppCard>
        <YStack gap="$2">
          <Text fontWeight="700">Hitos</Text>
          {milestones.map((task) => {
            const done = task.status === 'COMPLETED';
            const taskWeek = task.scheduledAt ? planWeekOf(plan, localDateKey(new Date(task.scheduledAt))) : null;
            return (
              <XStack key={task.id} gap="$2" alignItems="center" opacity={done ? 0.6 : 1}>
                <input
                  type="checkbox"
                  checked={done}
                  disabled={done || busy}
                  onChange={() => void run(() => completeTask(task, task.estimatedMinutes))}
                />
                <Text flex={1} textDecorationLine={done ? 'line-through' : 'none'}>
                  {taskWeek ? `Semana ${taskWeek} · ` : ''}
                  {task.title}
                </Text>
              </XStack>
            );
          })}
        </YStack>
      </AppCard>

      <AppCard>
        <YStack gap="$2">
          <Text fontWeight="700">Reglas de ajuste</Text>
          <Paragraph margin={0} color="$muted" fontSize="$2">
            No se aplican solas: en el calendario, cada bloque tiene «Mover a carrera» y «Mover a datos», que lo cambian
            solo ese día.
          </Paragraph>
          {plan.reglas_de_ajuste.map((rule) => (
            <Text key={rule} fontSize="$3">
              · {rule}
            </Text>
          ))}
        </YStack>
      </AppCard>

      <AppCard>
        <YStack gap="$2">
          <Text fontWeight="700">Fecha de inicio</Text>
          <XStack gap="$2" alignItems="center" flexWrap="wrap">
            <Text>Semana 1 empieza el lunes</Text>
            <input type="date" value={startInput} onChange={(e) => setStartInput(e.target.value)} />
            <AppButton
              variant="small"
              disabled={busy}
              onPress={() =>
                validStart() &&
                void run(async () => {
                  const next = { ...plan, startDate: startInput };
                  await saveStudyPlan(next);
                  await syncMilestoneTasks(next, tasks);
                })
              }
            >
              Guardar
            </AppButton>
          </XStack>
          <Text color="$muted" fontSize="$2">
            {PLAN_WEEKS} semanas: hasta el {weekLabel(planWeekStart(plan, plan.weeks + 1))}. Los hitos se mueven con la fecha.
          </Text>
          {error ? <Text color="$error">{error}</Text> : null}
        </YStack>
      </AppCard>
    </YStack>
  );
}
