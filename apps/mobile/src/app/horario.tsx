import {
  isMondayKey,
  isPlanCategory,
  localDateKey,
  nextMondayKey,
  PLAN_CATEGORY_INFO,
  phaseForWeek,
  planWeekOf,
  planWeekStart,
  weekProgress,
} from '@calendar/shared';
import { AppButton, AppCard, H1, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView } from 'react-native';
import { Input } from 'tamagui';
import { useCalendarData } from '../hooks/useCalendarData';
import { changePlanStart, importTimetable } from '../lib/plan/api';

// Phone port of the desktop's Horario panel (apps/web/src/pages/HorarioPage.tsx, horario
// 2026-10-19): load the timetable, the start Monday, this week's pomodoros by category and
// "cortar tramo" uses, milestones and the adjustment rules.

function weekLabel(start: string): string {
  const [y, m, d] = start.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export default function HorarioScreen() {
  const { plan, exceptions, schedules, tasks, pomodoroSessions, isLoading, completeTask, refetch } = useCalendarData();
  const [startInput, setStartInput] = useState(() => nextMondayKey(new Date()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (plan) setStartInput(plan.startDate);
  }, [plan?.startDate]);

  const week = plan ? planWeekOf(plan, localDateKey(new Date())) : 0;
  const shownWeek = plan ? Math.min(Math.max(week, 1), plan.weeks) : 1;
  const progress = useMemo(
    () => (plan ? weekProgress(pomodoroSessions, schedules, exceptions, planWeekStart(plan, shownWeek)) : null),
    [plan, pomodoroSessions, schedules, exceptions, shownWeek],
  );

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }

  function validStart(): boolean {
    if (isMondayKey(startInput)) return true;
    setError('La semana 1 tiene que empezar un lunes (AAAA-MM-DD).');
    return false;
  }

  const header = (
    <Stack.Screen
      options={{ title: 'Horario', headerShown: true, headerStyle: { backgroundColor: '#212e28' }, headerTintColor: '#f2f7f4' }}
    />
  );

  if (!plan) {
    const oldWork = schedules.filter((s) => s.kind === 'WORK').length;
    return (
      <ScrollView style={{ flex: 1, backgroundColor: '#212e28' }}>
        {header}
        <YStack padding="$6" gap="$4" maxWidth={560} width="100%" alignSelf="center">
          <H1 margin={0}>Cargar el horario</H1>
          <Paragraph margin={0} color="$muted">
            Lunes a viernes: estudio 09:30-12:30, almuerzo 12:30-14:00, tarde 14:00-15:25 y 15:35-17:00. Sábado: 09:00-10:30
            y 11:00-12:30. 14 semanas en 3 fases, con hitos y el ejercicio al despertar (08:00-09:00).
          </Paragraph>
          <Text>Semana 1 empieza el lunes (AAAA-MM-DD)</Text>
          <Input value={startInput} onChangeText={setStartInput} width={160} />
          <AppButton
            variant="primary"
            disabled={busy || isLoading}
            onPress={() =>
              validStart() &&
              Alert.alert('Cargar horario', `Se borran tus ${oldWork} bloques de trabajo actuales y se crean los del horario.`, [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Cargar', onPress: () => void run(() => importTimetable(startInput)) },
              ])
            }
          >
            {busy ? 'Cargando...' : 'Cargar horario'}
          </AppButton>
          {error ? <Text color="$danger">{error}</Text> : null}
        </YStack>
      </ScrollView>
    );
  }

  const phase = phaseForWeek(plan, shownWeek);
  const milestones = tasks
    .filter((t) => t.clientId?.startsWith('hito:') && !t.deletedAt)
    .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''));
  const title = week < 1 ? `Empieza el ${weekLabel(plan.startDate)}` : week > plan.weeks ? 'Plan terminado' : `Semana ${week} de ${plan.weeks}`;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#212e28' }}>
      {header}
      <YStack padding="$6" gap="$4" maxWidth={560} width="100%" alignSelf="center">
        <YStack gap="$1">
          <H1 margin={0}>{title}</H1>
          {phase ? <Paragraph margin={0} color="$muted">{phase.nombre}</Paragraph> : null}
        </YStack>

        <AppCard>
          <YStack gap="$2">
            <Text fontWeight="700">Semana {shownWeek}: pomodoros por categoría</Text>
            {progress && Object.keys(progress.pomodorosByCategory).length ? (
              Object.entries(progress.pomodorosByCategory).map(([category, count]) => (
                <XStack key={category} gap="$2" alignItems="center">
                  <YStack width={10} height={10} borderRadius={5} backgroundColor={isPlanCategory(category) ? PLAN_CATEGORY_INFO[category].color : '#888'} />
                  <Text flex={1}>{isPlanCategory(category) ? PLAN_CATEGORY_INFO[category].name : category}</Text>
                  <Text fontWeight="700">{count}</Text>
                </XStack>
              ))
            ) : (
              <Text color="$muted">Todavía no hay pomodoros completados esta semana.</Text>
            )}
            <Text color="$muted" fontSize="$2">
              «Cortar tramo» esta semana: {progress?.cuts ?? 0}
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
                <Pressable key={task.id} disabled={done || busy} onPress={() => void run(() => completeTask(task))}>
                  <XStack gap="$2" alignItems="center" opacity={done ? 0.55 : 1} paddingVertical="$1">
                    <Text fontSize="$5">{done ? '☑' : '☐'}</Text>
                    <Text flex={1} textDecorationLine={done ? 'line-through' : 'none'}>
                      {taskWeek ? `Semana ${taskWeek} · ` : ''}
                      {task.title}
                    </Text>
                  </XStack>
                </Pressable>
              );
            })}
          </YStack>
        </AppCard>

        <AppCard>
          <YStack gap="$2">
            <Text fontWeight="700">Reglas de ajuste</Text>
            <Text color="$muted" fontSize="$2">
              En el calendario, toca un bloque → «Cambiar hoy…» para moverlo a carrera o datos, cambiarle la hora o
              intercambiarlo, solo ese día.
            </Text>
            {plan.reglas_de_ajuste.map((rule) => (
              <Text key={rule} fontSize="$3">
                · {rule}
              </Text>
            ))}
          </YStack>
        </AppCard>

        <AppCard>
          <YStack gap="$2">
            <Text fontWeight="700">Fecha de inicio (lunes, AAAA-MM-DD)</Text>
            <XStack gap="$2" alignItems="center">
              <Input value={startInput} onChangeText={setStartInput} width={160} />
              <AppButton disabled={busy} onPress={() => validStart() && void run(() => changePlanStart(plan, startInput))}>
                Guardar
              </AppButton>
            </XStack>
            {error ? <Text color="$danger">{error}</Text> : null}
          </YStack>
        </AppCard>
      </YStack>
    </ScrollView>
  );
}
