import { ATTENTION_PROFILE_SPECS } from '@calendar/shared';
import { AppButton, AppCard, Eyebrow, H1, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useCalendarData } from '../hooks/useCalendarData';
import { ApiError } from '../lib/auth/api';
import { syncTaskBatch, type TaskSyncChangeDto } from '../lib/calendar/api';
import type { SyncTaskRecord } from '../lib/calendar/types';
import { hhmm } from '../lib/blockPrompt/notifications';
import { proposePlan, weekToPlan, type PlanAssignment, type PlanProposal } from '../lib/planning/api';

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(y, m - 1, d);
  return `${WEEKDAYS[day.getDay()]} ${d} ${MONTHS[m - 1]}`;
}

/** Where an accepted task lands: inside its block, or that day with no time when it has no block. */
function scheduledAt(a: PlanAssignment): string {
  const [y, m, d] = a.date.split('-').map(Number);
  const minute = a.startMinute ?? 0;
  return new Date(y, m - 1, d, Math.floor(minute / 60), minute % 60).toISOString();
}

function acceptPayload(task: SyncTaskRecord, a: PlanAssignment): TaskSyncChangeDto {
  return {
    id: task.id,
    updatedAt: new Date().toISOString(),
    title: task.title,
    description: task.description ?? undefined,
    scheduledAt: scheduledAt(a),
    estimatedMinutes: task.estimatedMinutes,
    estimatedPomodoros: task.estimatedPomodoros ?? undefined,
    difficulty: task.difficulty,
    complexity: task.complexity,
    priority: a.priority,
    category: task.category ?? undefined,
    status: task.status,
  };
}

/**
 * The weekly plan (task 8.13): the AI places the pending tasks in the coming week's WORK blocks,
 * each with its reason, and nothing reaches the calendar until it's accepted here. Opened from
 * the home screen, or from the notification the Friday "plan de la semana" block sends.
 */
export default function PlanScreen() {
  const { tasks, schedules, refetch } = useCalendarData();
  const [proposal, setProposal] = useState<PlanProposal | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const from = useMemo(() => weekToPlan(), []);

  const plan = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSavedCount(null);
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const result = await proposePlan({ timeZone, from, days: 7 });
      setProposal(result);
      setSelected(new Set(result.accepted.map((a) => a.taskId)));
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo armar el plan.');
    } finally {
      setLoading(false);
    }
  }, [from]);

  useEffect(() => {
    void plan();
  }, [plan]);

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const labelById = useMemo(() => new Map(schedules.map((s) => [s.id, s.label ?? 'Bloque de trabajo'])), [schedules]);
  const byDay = useMemo(() => {
    const groups = new Map<string, PlanAssignment[]>();
    for (const a of proposal?.accepted ?? []) groups.set(a.date, [...(groups.get(a.date) ?? []), a]);
    return [...groups];
  }, [proposal]);

  const toggle = (taskId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });

  const accept = async () => {
    if (!proposal) return;
    setSaving(true);
    setError(null);
    try {
      const changes = proposal.accepted
        .filter((a) => selected.has(a.taskId) && taskById.has(a.taskId))
        .map((a) => acceptPayload(taskById.get(a.taskId)!, a));
      await syncTaskBatch(changes);
      setSavedCount(changes.length);
      setProposal(null);
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el plan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#212e28' }} contentContainerStyle={{ alignItems: 'center' }}>
      <YStack width="100%" maxWidth={560} padding="$5" gap="$4">
        <Stack.Screen
          options={{ title: 'Plan de la semana', headerShown: true, headerStyle: { backgroundColor: '#212e28' }, headerTintColor: '#f2f7f4' }}
        />
        <YStack gap="$1">
          <Eyebrow>Planificación con IA</Eyebrow>
          <H1 marginTop={0} marginBottom={0}>
            Semana desde el {dayLabel(from)}
          </H1>
          <Paragraph color="$muted" margin={0}>
            La IA reparte tus tareas pendientes en tus bloques según tus reglas. Nada entra al calendario hasta que lo aceptes.
          </Paragraph>
        </YStack>

        {loading ? (
          <AppCard>
            <Paragraph margin={0}>Armando el plan… Gemini puede tardar uno o dos minutos.</Paragraph>
          </AppCard>
        ) : null}

        {error ? (
          <Text color="$danger" fontSize="$3">
            {error}
          </Text>
        ) : null}

        {savedCount !== null ? (
          <AppCard>
            <Paragraph margin={0}>Listo: {savedCount} tareas quedaron en el calendario.</Paragraph>
          </AppCard>
        ) : null}

        {proposal ? (
          <>
            <Paragraph color="$muted" margin={0} fontSize="$2">
              {proposal.accepted.length} propuestas · {proposal.unplaced.length} sin lugar esta semana
              {proposal.rejected.length ? ` · ${proposal.rejected.length} descartadas por las reglas` : ''} · planificó {proposal.planner}
            </Paragraph>

            {proposal.accepted.length === 0 ? (
              <AppCard>
                <Paragraph margin={0}>No hay nada para ubicar en estos días.</Paragraph>
              </AppCard>
            ) : null}

            {byDay.map(([date, items]) => (
              <YStack key={date} gap="$2">
                <Text fontSize="$4" fontWeight="700">
                  {dayLabel(date)}
                </Text>
                {items.map((a) => {
                  const task = taskById.get(a.taskId);
                  const on = selected.has(a.taskId);
                  const profile = task?.attentionProfile ? ATTENTION_PROFILE_SPECS[task.attentionProfile].name : null;
                  return (
                    <Pressable key={a.taskId} onPress={() => toggle(a.taskId)}>
                      <AppCard opacity={on ? 1 : 0.5}>
                        <XStack gap="$3" alignItems="flex-start">
                          <YStack
                            width={22}
                            height={22}
                            borderRadius={6}
                            borderWidth={2}
                            borderColor="$accent"
                            backgroundColor={on ? '$accent' : 'transparent'}
                            marginTop={2}
                          />
                          <YStack flex={1} gap="$1">
                            <Text fontSize="$3" fontWeight="700">
                              {a.startMinute !== null ? `${hhmm(a.startMinute)} · ` : ''}
                              {task?.title ?? 'Tarea'}
                            </Text>
                            <Text fontSize="$2" color="$muted">
                              {a.scheduleId ? labelById.get(a.scheduleId) : 'Ese día, sin bloque'}
                              {profile ? ` · ${profile}` : ''}
                              {a.priority === 'HIGH' ? ' · prioridad alta' : ''}
                            </Text>
                            <Text fontSize="$2" color="$muted">
                              {a.reason}
                            </Text>
                          </YStack>
                        </XStack>
                      </AppCard>
                    </Pressable>
                  );
                })}
              </YStack>
            ))}

            {proposal.warnings.length ? (
              <Text fontSize="$1" color="$muted">
                {proposal.warnings.join(' ')}
              </Text>
            ) : null}

            <AppButton variant="primary" onPress={() => void accept()} disabled={saving || selected.size === 0}>
              {saving ? 'Guardando…' : `Aceptar ${selected.size} ${selected.size === 1 ? 'tarea' : 'tareas'}`}
            </AppButton>
          </>
        ) : null}

        <AppButton variant="ghost" onPress={() => void plan()} disabled={loading}>
          Volver a planear
        </AppButton>
      </YStack>
    </ScrollView>
  );
}
