import { useMemo, useState } from 'react';
import { localDateKey, projectsNeedingAttention } from '@calendar/shared';
import { AppButton, H1, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { DayTasksSidebar } from '../calendar/DayTasksSidebar';
import { PlanSuggestionCard } from '../planning/PlanSuggestionCard';
import { usePanel } from '../../context/PanelContext';
import { useCalendarData } from '../../hooks/useCalendarData';
import { useNow, useToday } from '../../hooks/useNow';
import { toggleEventDone } from '../../lib/calendar/completions';
import { buildEventsForRange, endOfDay } from '../../lib/calendar/utils';
import { categoryColor } from '../calendar/eventStyles';
import { SectionTitle, StripeCard, SummaryLine } from './parts';

const clock = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// agenda-redesign (2026-11-09): the Hoy page, laid out like the Agenda board the user liked -- a dated
// summary first, then two columns: what's now and the day's blocks; attention, habits and the week.
export function HoyDashboard() {
  const data = useCalendarData();
  const now = useNow();
  const today = useToday();
  const { openPanel } = usePanel();
  const [busy, setBusy] = useState(false);

  const todayEvents = useMemo(
    () =>
      buildEventsForRange(
        {
          tasks: data.tasks,
          schedules: data.schedules,
          pomodoroSessions: data.pomodoroSessions,
          fitnessEntries: data.fitnessEntries,
          habits: data.habits,
          habitRecords: data.habitRecords,
          scheduleCompletions: data.scheduleCompletions,
          scheduleExceptions: data.scheduleExceptions,
          studyPlan: data.studyPlan,
        },
        today,
        endOfDay(today),
      ),
    [data, today],
  );
  const blocks = todayEvents.filter((e) => e.type === 'work').sort((a, b) => a.start.getTime() - b.start.getTime());
  const current = blocks.find((b) => b.start <= now && now < b.end) ?? null;
  const next = blocks.find((b) => b.start > now) ?? null;
  const habits = todayEvents.filter((e) => e.type === 'habit');
  const attention = useMemo(
    () => projectsNeedingAttention(data.projects, data.projectLogEntries.map((l) => ({ ...l, date: l.date.slice(0, 10) })), localDateKey(today)),
    [data.projects, data.projectLogEntries, today],
  );
  const projectById = new Map(data.projects.map((p) => [p.id, p]));
  const pendingTasks = data.tasks.filter((t) => !t.deletedAt && t.status !== 'COMPLETED' && t.scheduledAt && new Date(t.scheduledAt) < endOfDay(today)).length;

  async function toggleHabit(event: (typeof habits)[number]) {
    setBusy(true);
    try {
      await toggleEventDone(event);
      await data.refetch();
    } finally {
      setBusy(false);
    }
  }

  const week = useMemo(() => {
    const days: Array<{ date: Date; items: string[] }> = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const key = localDateKey(d);
      const items = [
        ...data.tasks
          .filter((t) => !t.deletedAt && t.status !== 'COMPLETED' && t.scheduledAt && localDateKey(new Date(t.scheduledAt)) === key)
          .map((t) => t.title),
        ...data.projects.filter((p) => p.status !== 'DONE' && p.deadline?.slice(0, 10) === key).map((p) => `Fecha límite: ${p.title}`),
      ];
      if (items.length) days.push({ date: d, items });
    }
    return days;
  }, [data.tasks, data.projects, today]);
  const dateTitle = today.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <YStack gap="$5">
      <YStack gap="$1">
        <H1 margin={0} fontFamily="$heading" fontSize="$9" fontWeight="500">
          {dateTitle.charAt(0).toUpperCase() + dateTitle.slice(1)}
        </H1>
        <SummaryLine>
          {blocks.length} {blocks.length === 1 ? 'bloque' : 'bloques'} hoy · {pendingTasks} {pendingTasks === 1 ? 'tarea pendiente' : 'tareas pendientes'} ·{' '}
          {attention.length} {attention.length === 1 ? 'proyecto pide' : 'proyectos piden'} atención
        </SummaryLine>
      </YStack>

      <XStack gap="$5" flexWrap="wrap" alignItems="flex-start">
        <YStack flex={1} minWidth={320} gap="$4">
          <YStack gap="$2">
            <SectionTitle>Ahora</SectionTitle>
            {current ? (
              <StripeCard color={categoryColor(current.meta?.category ?? null)}>
                <Text fontSize="$2" color="$muted">
                  {clock(current.start)}–{clock(current.end)} · en curso
                </Text>
                <Text fontWeight="700" fontSize="$6">
                  {current.title}
                </Text>
                {current.meta?.description ? (
                  <Paragraph margin={0} size="$3" color="$muted">
                    {current.meta.description}
                  </Paragraph>
                ) : null}
                <AppButton variant="primary" alignSelf="flex-start" onPress={() => openPanel('pomodoro')}>
                  Empezar
                </AppButton>
              </StripeCard>
            ) : (
              <Paragraph margin={0} color="$muted">
                Ningún bloque en curso{next ? `; el siguiente es a las ${clock(next.start)}.` : '.'}
              </Paragraph>
            )}
          </YStack>

          <YStack gap="$2">
            <SectionTitle>Bloques del día</SectionTitle>
            {blocks.length === 0 ? (
              <Paragraph margin={0} color="$muted">
                Hoy no hay bloques.
              </Paragraph>
            ) : (
              blocks.map((b) => {
                const state = b.end <= now ? 'past' : b.start <= now ? 'now' : 'next';
                return (
                  <XStack
                    key={b.id}
                    gap="$3"
                    alignItems="center"
                    padding="$2"
                    borderRadius="$2"
                    borderWidth={1}
                    borderColor={state === 'now' ? '$accent' : '$borderColor'}
                    backgroundColor={state === 'now' ? '$accentBackground' : 'transparent'}
                    opacity={state === 'past' ? 0.55 : 1}
                  >
                    <YStack width={4} alignSelf="stretch" borderRadius={2} backgroundColor={categoryColor(b.meta?.category ?? null) ?? '$accent'} />
                    <Text fontSize="$2" color="$muted" width={96}>
                      {clock(b.start)}–{clock(b.end)}
                    </Text>
                    <Text flex={1}>{b.meta?.done ? '✓ ' : ''}{b.title}</Text>
                  </XStack>
                );
              })
            )}
          </YStack>

          <DayTasksSidebar selectedDate={today} />
        </YStack>

        <YStack flex={1} minWidth={300} gap="$4">
          <YStack gap="$2">
            <SectionTitle>Proyectos que piden atención</SectionTitle>
            {attention.length === 0 ? (
              <Paragraph margin={0} color="$muted">
                Todo al día.
              </Paragraph>
            ) : (
              attention.slice(0, 5).map((a) => {
                const p = projectById.get(a.projectId);
                return (
                  <StripeCard key={a.projectId} color={p?.color}>
                    <Text fontWeight="600">{p?.title ?? 'Proyecto'}</Text>
                    <Text fontSize="$2" color={a.kind === 'stale' ? '$muted' : '$danger'}>
                      {a.reason}
                    </Text>
                  </StripeCard>
                );
              })
            )}
          </YStack>

          <YStack gap="$2">
            <SectionTitle>Hábitos de hoy</SectionTitle>
            {habits.length === 0 ? (
              <Paragraph margin={0} color="$muted">
                Sin hábitos para hoy.
              </Paragraph>
            ) : (
              habits.map((h) => (
                <XStack key={h.id} gap="$2" alignItems="center">
                  <input
                    type="checkbox"
                    checked={Boolean(h.meta?.done)}
                    disabled={busy}
                    onChange={() => void toggleHabit(h)}
                    aria-label={h.title}
                    style={{ width: 18, height: 18 }}
                  />
                  <Text flex={1} color={h.meta?.done ? '$muted' : '$color'} textDecorationLine={h.meta?.done ? 'line-through' : 'none'}>
                    {h.title}
                  </Text>
                  {h.meta?.habitWhen ? (
                    <Text fontSize="$2" color="$muted">
                      {h.meta.habitWhen}
                    </Text>
                  ) : null}
                </XStack>
              ))
            )}
          </YStack>

          <YStack gap="$2">
            <SectionTitle>Próximos 7 días</SectionTitle>
            {week.length === 0 ? (
              <Paragraph margin={0} color="$muted">
                Semana despejada.
              </Paragraph>
            ) : (
              week.map((d) => (
                <XStack key={d.date.toISOString()} gap="$3">
                  <Text fontSize="$2" color="$muted" width={96}>
                    {d.date.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </Text>
                  <Text flex={1} fontSize="$3">
                    {d.items.join(' · ')}
                  </Text>
                </XStack>
              ))
            )}
          </YStack>

          <YStack gap="$2">
            <SectionTitle>Fechas de cierre del radar</SectionTitle>
            <Paragraph margin={0} size="$2" color="$muted">
              Llegan aquí cuando los radares escriban en el calendario (research-tracking). Por ahora, en Investigación.
            </Paragraph>
          </YStack>

          <PlanSuggestionCard />
        </YStack>
      </XStack>
    </YStack>
  );
}
