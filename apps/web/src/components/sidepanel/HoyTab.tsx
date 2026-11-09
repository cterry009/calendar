import { useMemo, useState } from 'react';
import { localDateKey, projectsNeedingAttention } from '@calendar/shared';
import { AppButton, AppCard, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { usePanel } from '../../context/PanelContext';
import { useCalendarData } from '../../hooks/useCalendarData';
import { useNow, useToday } from '../../hooks/useNow';
import { toggleEventDone } from '../../lib/calendar/completions';
import { buildEventsForRange, endOfDay } from '../../lib/calendar/utils';
import { categoryColor } from '../calendar/eventStyles';
import { DayTasksSidebar } from '../calendar/DayTasksSidebar';
import { MiniMonthCalendar } from '../calendar/MiniMonthCalendar';
import { MorningCard } from '../morning/MorningCard';
import { PlanSuggestionCard } from '../planning/PlanSuggestionCard';
import { ScheduleManager } from '../schedules/ScheduleManager';
import { SectionTitle, StripeCard, SummaryLine } from './parts';

const clock = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export function HoyTab({ selectedDate, onSelectDate }: { selectedDate: Date; onSelectDate: (date: Date) => void }) {
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

  return (
    <YStack gap="$4">
      <SummaryLine>
        {blocks.length} {blocks.length === 1 ? 'bloque' : 'bloques'} hoy · {pendingTasks} {pendingTasks === 1 ? 'tarea pendiente' : 'tareas pendientes'} ·{' '}
        {attention.length} {attention.length === 1 ? 'proyecto pide' : 'proyectos piden'} atención
      </SummaryLine>

      <YStack gap="$2">
        <SectionTitle>Ahora</SectionTitle>
        {current ? (
          <StripeCard color={categoryColor(current.meta?.category ?? null)}>
            <Text fontSize="$2" color="$muted">
              {clock(current.start)}–{clock(current.end)} · en curso
            </Text>
            <Text fontWeight="700" fontSize="$5">
              {current.title}
            </Text>
            {current.meta?.description ? (
              <Paragraph margin={0} size="$2" color="$muted">
                {current.meta.description}
              </Paragraph>
            ) : null}
            <AppButton variant="primary" alignSelf="flex-start" onPress={() => openPanel('pomodoro')}>
              Empezar
            </AppButton>
          </StripeCard>
        ) : (
          <Paragraph margin={0} color="$muted">
            Ningún bloque en curso.
          </Paragraph>
        )}
        {next ? (
          <StripeCard color={categoryColor(next.meta?.category ?? null)}>
            <Text fontSize="$2" color="$muted">
              Siguiente · {clock(next.start)}–{clock(next.end)}
            </Text>
            <Text fontWeight="600">{next.title}</Text>
          </StripeCard>
        ) : null}
      </YStack>

      {attention.length ? (
        <YStack gap="$2">
          <SectionTitle>Proyectos que piden atención</SectionTitle>
          {attention.slice(0, 4).map((a) => {
            const p = projectById.get(a.projectId);
            return (
              <StripeCard key={a.projectId} color={p?.color}>
                <Text fontWeight="600">{p?.title ?? 'Proyecto'}</Text>
                <Text fontSize="$2" color={a.kind === 'stale' ? '$muted' : '$danger'}>
                  {a.reason}
                </Text>
              </StripeCard>
            );
          })}
        </YStack>
      ) : null}

      {habits.length ? (
        <YStack gap="$2">
          <SectionTitle>Hábitos de hoy</SectionTitle>
          {habits.map((h) => (
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
          ))}
        </YStack>
      ) : null}

      <YStack gap="$2">
        <SectionTitle>Fechas de cierre del radar</SectionTitle>
        <Paragraph margin={0} size="$2" color="$muted">
          Llegan aquí con la sección Investigación (research-tracking). Mientras tanto, mira la pestaña Investigación.
        </Paragraph>
      </YStack>

      <DayTasksSidebar selectedDate={selectedDate} />
      <PlanSuggestionCard />
      <MorningCard />
      <AppCard>
        <MiniMonthCalendar selectedDate={selectedDate} onSelectDate={onSelectDate} />
      </AppCard>
      <YStack data-tutorial="schedule-header">
        <ScheduleManager />
      </YStack>
    </YStack>
  );
}
