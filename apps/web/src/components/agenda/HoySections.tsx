import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { localDateKey, projectsNeedingAttention } from '@calendar/shared';
import { AppButton, H1, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { usePanel } from '../../context/PanelContext';
import { useQuickAdd } from '../../context/QuickAddContext';
import { useCalendarData } from '../../hooks/useCalendarData';
import { useNow, useToday } from '../../hooks/useNow';
import { useTasks } from '../../hooks/useTasks';
import { syncBatch } from '../../lib/offline/sync-client';
import { buildCheckInPayload, buildDeleteCheckInPayload } from '../../lib/habits/sync';
import { buildEventsForRange, endOfDay } from '../../lib/calendar/utils';
import type { SyncTaskRecord } from '../../lib/tasks/types';
import { categoryColor } from '../calendar/eventStyles';
import { rememberTab } from './SubTabs';
import { Pill, ProgressBar, StripeCard } from './parts';

// agenda-redesign (2026-11-09): Hoy laid out like the first Agenda board the user picked -- a hero card
// (date, one summary line, energy), three cards side by side (the day's blocks, today's agenda,
// tasks), then today's habits with quick amounts and the next seven days.

const clock = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const ENERGY_KEY = (day: string) => `calendar.energia.${day}`;

function readEnergy(day: string): number {
  try {
    const v = Number(window.localStorage.getItem(ENERGY_KEY(day)));
    return Number.isFinite(v) && v > 0 ? v : 60;
  } catch {
    return 60;
  }
}

function Card({ title, action, children, minWidth = 300 }: { title: string; action?: ReactNode; children: ReactNode; minWidth?: number }) {
  return (
    <YStack
      flex={1}
      flexBasis={minWidth}
      minWidth={minWidth}
      backgroundColor="$surface"
      borderWidth={1}
      borderColor="$borderColor"
      borderRadius="$4"
      padding="$4"
      gap="$3"
    >
      <XStack justifyContent="space-between" alignItems="center" gap="$2">
        <Text fontSize={12} fontWeight="700" letterSpacing={1.2} color="$muted" textTransform="uppercase">
          {title}
        </Text>
        {action}
      </XStack>
      {children}
    </YStack>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <Paragraph margin={0} size="$2" color="$muted">
      {children}
    </Paragraph>
  );
}

export function HoyDashboard() {
  const data = useCalendarData();
  const { tasks, completeTask, isMutating } = useTasks();
  const now = useNow();
  const today = useToday();
  const todayKey = localDateKey(today);
  const navigate = useNavigate();
  const { openPanel } = usePanel();
  const { open: openQuickAdd } = useQuickAdd();
  const [energy, setEnergy] = useState(() => readEnergy(todayKey));
  const [busyHabit, setBusyHabit] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

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
  const byStart = (a: { start: Date }, b: { start: Date }) => a.start.getTime() - b.start.getTime();
  const blocks = todayEvents.filter((e) => e.type === 'work').sort(byStart);
  const agenda = todayEvents.filter((e) => e.type !== 'work' && e.type !== 'habit').sort(byStart);
  const current = blocks.find((b) => b.start <= now && now < b.end) ?? null;
  const next = blocks.find((b) => b.start > now) ?? null;

  // R3 (2026-11-13): today first; overdue and unassigned in sections that fold, so the list doesn't swamp the page.
  const open = tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && !t.deletedAt);
  const todayStart = today.getTime();
  const todayEnd = endOfDay(today).getTime();
  const at = (t: SyncTaskRecord) => (t.scheduledAt ? new Date(t.scheduledAt).getTime() : null);
  const PRIORITY_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
  const byPriority = (a: SyncTaskRecord, b: SyncTaskRecord) =>
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (at(a) ?? 0) - (at(b) ?? 0);
  const dueToday = open.filter((t) => { const x = at(t); return x !== null && x >= todayStart && x < todayEnd; });
  const overdue = open.filter((t) => { const x = at(t); return x !== null && x < todayStart; }).sort(byPriority);
  const unassigned = open.filter((t) => !t.scheduledAt);

  const attention = useMemo(
    () => projectsNeedingAttention(data.projects, data.projectLogEntries.map((l) => ({ ...l, date: l.date.slice(0, 10) })), todayKey),
    [data.projects, data.projectLogEntries, todayKey],
  );
  const projectById = new Map(data.projects.map((p) => [p.id, p]));

  const habits = data.habits.filter((h) => !h.archived);
  const recordOf = (habitId: string) => data.habitRecords.find((r) => r.habitId === habitId && r.date.slice(0, 10) === todayKey);

  const week = useMemo(() => {
    const days: Array<{ date: Date; items: Array<{ id: string; label: string; color?: string | null }> }> = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const key = localDateKey(d);
      days.push({
        date: d,
        items: [
          ...data.tasks
            .filter((t) => !t.deletedAt && t.status !== 'COMPLETED' && t.scheduledAt && localDateKey(new Date(t.scheduledAt)) === key)
            .map((t) => ({ id: t.id, label: t.title })),
          ...data.projects
            .filter((p) => p.status !== 'DONE' && p.deadline?.slice(0, 10) === key)
            .map((p) => ({ id: p.id, label: `Cierre: ${p.title}`, color: p.color })),
        ],
      });
    }
    return days;
  }, [data.tasks, data.projects, today]);

  function changeEnergy(v: number) {
    setEnergy(v);
    try {
      window.localStorage.setItem(ENERGY_KEY(todayKey), String(v));
    } catch {
      /* per-device only */
    }
  }

  async function setHabitValue(habitId: string, value: number) {
    const record = recordOf(habitId);
    setBusyHabit(habitId);
    try {
      const change =
        value <= 0
          ? record
            ? buildDeleteCheckInPayload(record.id)
            : null
          : buildCheckInPayload(habitId, { date: todayKey, value, status: 'DONE' }, record?.id);
      if (change) await syncBatch({ habitRecords: [change] });
      await data.refetch();
    } finally {
      setBusyHabit(null);
      setDrafts((d) => {
        const rest = { ...d };
        delete rest[habitId];
        return rest;
      });
    }
  }

  async function done(task: SyncTaskRecord) {
    await completeTask(task, task.estimatedMinutes);
    await data.refetch();
  }

  function editSchedule() {
    rememberTab('calendar.calendario.view', 'horario');
    navigate('/calendar');
  }

  const dateTitle = today.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const summary = [
    `${blocks.length} ${blocks.length === 1 ? 'bloque' : 'bloques'}`,
    `${agenda.length} en agenda`,
    `${dueToday.length} ${dueToday.length === 1 ? 'tarea para hoy' : 'tareas para hoy'}`,
    attention.length ? `${attention.length} ${attention.length === 1 ? 'proyecto pide' : 'proyectos piden'} atención` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const taskRow = (t: SyncTaskRecord) => (
    <XStack key={t.id} gap="$2" alignItems="center">
      <input
        type="checkbox"
        checked={false}
        disabled={isMutating}
        onChange={() => void done(t)}
        aria-label={`Completar ${t.title}`}
        style={{ width: 18, height: 18 }}
      />
      <Text flex={1}>{t.title}</Text>
      {t.priority === 'HIGH' ? <Pill tone="danger">alta</Pill> : null}
      {t.scheduledAt ? (
        <Text fontSize="$2" color="$muted">
          {clock(new Date(t.scheduledAt))}
        </Text>
      ) : null}
    </XStack>
  );

  return (
    <YStack gap="$5">
      {/* Hero */}
      <XStack
        backgroundColor="$surface"
        borderWidth={1}
        borderColor="$borderColor"
        borderRadius="$5"
        padding="$5"
        gap="$5"
        flexWrap="wrap"
        justifyContent="space-between"
        alignItems="center"
      >
        <YStack gap="$2" flex={1} minWidth={280}>
          <Text fontSize={12} fontWeight="700" letterSpacing={1.2} color="$muted" textTransform="uppercase">
            Hoy
          </Text>
          <H1 margin={0} fontFamily="$heading" fontSize="$9" fontWeight="500">
            {dateTitle.charAt(0).toUpperCase() + dateTitle.slice(1)}
          </H1>
          <Paragraph margin={0} color="$muted">
            {summary}
          </Paragraph>
          {current ? (
            <XStack gap="$2" alignItems="center" flexWrap="wrap">
              <Text>
                Ahora: <Text fontWeight="700">{current.title}</Text> hasta las {clock(current.end)}
              </Text>
              <AppButton variant="small" onPress={() => openPanel('pomodoro')}>
                Empezar
              </AppButton>
            </XStack>
          ) : next ? (
            <Text color="$muted">Siguiente bloque: {next.title} a las {clock(next.start)}</Text>
          ) : null}
        </YStack>
        <YStack gap="$2" width={260}>
          <XStack justifyContent="space-between">
            <Text fontSize="$2" color="$muted">
              Energía (0–100)
            </Text>
            <Text fontWeight="700">{energy}</Text>
          </XStack>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={energy}
            onChange={(e) => changeEnergy(Number(e.target.value))}
            aria-label="Energía de hoy"
            style={{ width: '100%' }}
          />
        </YStack>
      </XStack>

      {/* Three cards */}
      <XStack gap="$4" flexWrap="wrap" alignItems="stretch">
        <Card
          title="Bloques del día"
          action={
            <AppButton variant="ghost" size="$2" onPress={editSchedule}>
              Editar
            </AppButton>
          }
        >
          {blocks.length === 0 ? (
            <Empty>Hoy no hay bloques.</Empty>
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
                  opacity={state === 'past' ? 0.55 : 1}
                >
                  <YStack width={4} alignSelf="stretch" borderRadius={2} backgroundColor={categoryColor(b.meta?.category ?? null) ?? '$accent'} />
                  <Text fontSize="$2" color="$muted" width={92}>
                    {clock(b.start)}–{clock(b.end)}
                  </Text>
                  <Text flex={1}>
                    {b.meta?.done ? '✓ ' : ''}
                    {b.title}
                  </Text>
                </XStack>
              );
            })
          )}
        </Card>

        <Card
          title="Agenda de hoy"
          action={
            <AppButton variant="ghost" size="$2" onPress={openQuickAdd}>
              + Evento
            </AppButton>
          }
        >
          {agenda.length === 0 ? (
            <Empty>Nada más agendado hoy.</Empty>
          ) : (
            agenda.map((e) => (
              <XStack key={e.id} gap="$3" alignItems="center">
                <Text fontSize="$2" color="$muted" width={48}>
                  {clock(e.start)}
                </Text>
                <Text flex={1}>{e.title}</Text>
              </XStack>
            ))
          )}
        </Card>

        <Card
          title="Tareas"
          action={
            <XStack gap="$1">
              <AppButton variant="ghost" size="$2" onPress={openQuickAdd}>
                + Tarea
              </AppButton>
              <AppButton variant="ghost" size="$2" onPress={() => navigate('/calendar')}>
                Editar
              </AppButton>
            </XStack>
          }
        >
          <TaskSection id="hoy" title="Hoy" count={dueToday.length} defaultOpen>
            {dueToday.length ? dueToday.map(taskRow) : <Empty>Nada programado para hoy.</Empty>}
          </TaskSection>
          {overdue.length ? (
            <TaskSection id="atrasadas" title="Atrasadas" count={overdue.length} tone="danger">
              {overdue.map(taskRow)}
            </TaskSection>
          ) : null}
          {unassigned.length ? (
            <TaskSection id="sin-asignar" title="Sin asignar" count={unassigned.length}>
              {groupUnassigned(unassigned, (id) => projectById.get(id)?.title ?? null).map((g) => (
                <TaskSection key={g.key} id={`sin-asignar:${g.key}`} title={g.title} count={g.tasks.length} nested>
                  {g.tasks.sort(byPriority).map(taskRow)}
                </TaskSection>
              ))}
            </TaskSection>
          ) : null}
        </Card>
      </XStack>

      {/* Habits */}
      <Card title="Hábitos de hoy" minWidth={600}>
        {habits.length === 0 ? (
          <Empty>Sin hábitos.</Empty>
        ) : (
          <XStack gap="$3" flexWrap="wrap">
            {habits.map((h) => {
              const value = recordOf(h.id)?.value ?? 0;
              const goal = h.dailyGoalValue || 1;
              const step = goal >= 10 ? Math.round(goal / 4) : 1;
              const draft = drafts[h.id];
              const pct = h.type === 'NEGATIVE' ? (value <= goal ? 100 : 0) : Math.round((value / goal) * 100);
              return (
                <YStack key={h.id} flexBasis={220} flexGrow={1} maxWidth={320} gap="$2" padding="$3" borderWidth={1} borderColor="$borderColor" borderRadius="$3">
                  <XStack justifyContent="space-between" gap="$2">
                    <Text fontWeight="600" flex={1}>
                      {h.title}
                    </Text>
                    <Text fontSize="$2" color="$muted">
                      meta {goal} {h.dailyGoalUnit}
                    </Text>
                  </XStack>
                  <XStack gap="$2" alignItems="center">
                    <input
                      type="number"
                      min={0}
                      value={draft ?? String(value)}
                      disabled={busyHabit === h.id}
                      onChange={(e) => setDrafts((d) => ({ ...d, [h.id]: e.target.value }))}
                      onBlur={() => draft !== undefined && void setHabitValue(h.id, Number(draft) || 0)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && draft !== undefined) void setHabitValue(h.id, Number(draft) || 0);
                      }}
                      aria-label={`${h.title} (${h.dailyGoalUnit})`}
                      style={{ width: 80, padding: 4 }}
                    />
                    <AppButton variant="small" disabled={busyHabit === h.id} onPress={() => void setHabitValue(h.id, value + step)}>
                      +{step}
                    </AppButton>
                    <Text fontSize="$2" color="$muted">
                      {h.dailyGoalUnit}
                    </Text>
                  </XStack>
                  <ProgressBar value={pct} color={h.color} />
                </YStack>
              );
            })}
          </XStack>
        )}
      </Card>

      {/* Next 7 days */}
      <Card title="Próximos 7 días" minWidth={600}>
        <XStack gap="$2" flexWrap="wrap">
          {week.map((d) => (
            <YStack key={d.date.toISOString()} flexBasis={130} flexGrow={1} gap="$1" padding="$2" borderWidth={1} borderColor="$borderColor" borderRadius="$3" minHeight={90}>
              <Text fontSize="$2" fontWeight="700" color="$muted">
                {d.date.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' })}
              </Text>
              {d.items.length === 0 ? (
                <Text fontSize="$2" color="$muted">
                  —
                </Text>
              ) : (
                d.items.slice(0, 4).map((it) => (
                  <Text key={it.id} fontSize="$2" numberOfLines={2}>
                    {it.label}
                  </Text>
                ))
              )}
            </YStack>
          ))}
        </XStack>
      </Card>

      {/* Attention */}
      {attention.length > 0 ? (
        <Card title="Proyectos que piden atención" minWidth={600}>
          <XStack gap="$3" flexWrap="wrap">
            {attention.slice(0, 6).map((a) => {
              const p = projectById.get(a.projectId);
              return (
                <YStack key={a.projectId} flexBasis={260} flexGrow={1}>
                  <StripeCard color={p?.color}>
                    <Text fontWeight="600">{p?.title ?? 'Proyecto'}</Text>
                    <Text fontSize="$2" color={a.kind === 'stale' ? '$muted' : '$danger'}>
                      {a.reason}
                    </Text>
                  </StripeCard>
                </YStack>
              );
            })}
          </XStack>
        </Card>
      ) : null}

    </YStack>
  );
}


/** R3: unassigned tasks by project (or category), groups with a high-priority task first. */
function groupUnassigned(
  tasks: SyncTaskRecord[],
  projectTitle: (id: string) => string | null,
): Array<{ key: string; title: string; tasks: SyncTaskRecord[] }> {
  const groups = new Map<string, { key: string; title: string; tasks: SyncTaskRecord[] }>();
  for (const t of tasks) {
    const project = t.projectId ? projectTitle(t.projectId) : null;
    const title = project ?? (t.category ? t.category.replace(/_/g, ' ') : 'Sin proyecto');
    const key = project ? `p:${t.projectId}` : t.category ? `c:${t.category}` : 'none';
    const g = groups.get(key) ?? { key, title, tasks: [] };
    g.tasks.push(t);
    groups.set(key, g);
  }
  const high = (g: { tasks: SyncTaskRecord[] }) => (g.tasks.some((t) => t.priority === 'HIGH') ? 0 : 1);
  return [...groups.values()].sort((a, b) => high(a) - high(b) || (a.key === 'none' ? 1 : b.key === 'none' ? -1 : a.title.localeCompare(b.title, 'es')));
}

const SECTION_KEY = 'calendar.hoy.sections';
function loadSections(): Record<string, boolean> {
  try {
    return JSON.parse(window.localStorage.getItem(SECTION_KEY) ?? '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}

/** A task section that folds; its open/closed state is remembered on this device. */
function TaskSection({
  id,
  title,
  count,
  defaultOpen = false,
  tone,
  nested = false,
  children,
}: {
  id: string;
  title: string;
  count: number;
  defaultOpen?: boolean;
  tone?: 'danger';
  nested?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => loadSections()[id] ?? defaultOpen);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      window.localStorage.setItem(SECTION_KEY, JSON.stringify({ ...loadSections(), [id]: next }));
    } catch {
      // Not remembered.
    }
  };
  return (
    <YStack gap="$2" paddingLeft={nested ? '$3' : 0}>
      <XStack
        gap="$2"
        alignItems="center"
        cursor="pointer"
        onPress={toggle}
        role="button"
        aria-expanded={open}
        paddingVertical="$1"
      >
        <Text color="$muted" width={14}>
          {open ? '▾' : '▸'}
        </Text>
        <Text fontWeight={nested ? '600' : '700'} fontSize={nested ? '$3' : '$4'} flex={1}>
          {title}
        </Text>
        <Text fontSize="$2" color={tone === 'danger' ? '$error' : '$muted'} fontWeight="700">
          {count}
        </Text>
      </XStack>
      {open ? <YStack gap="$2" paddingLeft="$4">{children}</YStack> : null}
    </YStack>
  );
}
