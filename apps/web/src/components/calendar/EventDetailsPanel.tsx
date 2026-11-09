import { useEffect, useMemo, useState } from 'react';
import { AppButton, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { usePanel } from '../../context/PanelContext';
import { usePomodoro } from '../../context/PomodoroContext';
import { useNow } from '../../hooks/useNow';
import { useTasks } from '../../hooks/useTasks';
import { eventDetails } from '../../lib/calendar/eventDetails';
import type { CalendarEvent, SyncTask } from '../../lib/calendar/types';
import { taskToFormValues } from '../../lib/tasks/types';
import { categoryColor } from './eventStyles';

// 2026-11-09: selecting an event opens this panel on the right -- what it is about, what to do,
// how to start, and its objectives (the tasks scheduled inside it; adding one schedules a task there,
// so objectives sync like any task). Esc or the backdrop closes it.

function timeRange(event: CalendarEvent): string {
  const f = (d: Date) => d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
  const day = event.start.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${f(event.start)}–${f(event.end)}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <YStack gap="$2">
      <Text fontSize="$2" fontWeight="700" color="$muted" textTransform="uppercase" letterSpacing={0.6}>
        {title}
      </Text>
      {children}
    </YStack>
  );
}

export function EventDetailsPanel({
  event,
  tasks,
  suggestedPomodoros,
  onClose,
  onChanged,
}: {
  event: CalendarEvent;
  tasks: SyncTask[];
  suggestedPomodoros: Partial<Record<string, string[]>> | null | undefined;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const now = useNow();
  const tasksData = useTasks();
  const pomodoro = usePomodoro();
  const { openPanel } = usePanel();
  const [newObjective, setNewObjective] = useState('');
  const [busy, setBusy] = useState(false);
  const details = useMemo(() => eventDetails(event, tasks, suggestedPomodoros, now), [event, tasks, suggestedPomodoros, now]);
  const color = categoryColor(event.meta?.category ?? null) ?? '$accent';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    if (event.type === 'task') {
      const minutes = Math.min(details.objectives[0]?.estimatedMinutes ?? 25, 50);
      await pomodoro.start(event.taskId, { focusDurationMin: minutes });
    }
    openPanel('pomodoro');
    onClose();
  }

  async function toggleObjective(task: SyncTask) {
    const record = tasksData.tasks.find((t) => t.id === task.id);
    if (!record) return;
    await run(async () => {
      if (task.status === 'COMPLETED') {
        await tasksData.updateTask(record.id, { ...taskToFormValues(record), status: 'PENDING' });
      } else {
        await tasksData.completeTask(record, record.estimatedMinutes);
      }
    });
  }

  async function addObjective() {
    const title = newObjective.trim();
    if (!title) return;
    await run(async () => {
      await tasksData.createTask({
        title,
        description: null,
        scheduledAt: event.start.toISOString(),
        estimatedMinutes: 25,
        estimatedPomodoros: 1,
        actualMinutes: null,
        difficulty: 'MEDIUM',
        complexity: 5,
        priority: 'MEDIUM',
        category: event.meta?.category ?? null,
        status: 'PENDING',
      });
      setNewObjective('');
    });
  }

  const canHaveObjectives = event.type === 'work' || event.type === 'task';
  const done = details.objectives.filter((t) => t.status === 'COMPLETED').length;

  return (
    <>
      <YStack position="fixed" top={0} left={0} right={0} bottom={0} backgroundColor="rgba(0,0,0,0.35)" zIndex={50} onPress={onClose} />
      <YStack
        position="fixed"
        top={0}
        right={0}
        bottom={0}
        width="min(440px, 100vw)"
        backgroundColor="$surface"
        borderLeftWidth={4}
        borderLeftColor={color}
        zIndex={51}
        padding="$5"
        gap="$4"
        overflow="scroll"
        role="dialog"
        aria-label={event.title}
      >
        <XStack justifyContent="space-between" alignItems="flex-start" gap="$3">
          <YStack flex={1} gap="$1">
            <Text fontSize="$2" color="$muted">
              {details.kindLabel}
              {details.categoryName ? ` · ${details.categoryName}` : ''}
            </Text>
            <H2 margin={0} fontSize="$7">
              {event.title}
            </H2>
            <Text fontSize="$3" color="$muted">
              {timeRange(event)}
            </Text>
          </YStack>
          <AppButton variant="ghost" onPress={onClose} aria-label="Cerrar">
            ✕
          </AppButton>
        </XStack>

        {details.about ? (
          <Section title="De qué se trata">
            <Paragraph margin={0}>{details.about}</Paragraph>
          </Section>
        ) : null}

        {details.todo.length ? (
          <Section title="Qué hacer">
            {details.todo.map((line) => (
              <Paragraph key={line} margin={0}>
                {line}
              </Paragraph>
            ))}
          </Section>
        ) : null}

        {details.howToStart.length ? (
          <Section title="Cómo empezar">
            {details.howToStart.map((line, i) => (
              <Paragraph key={line} margin={0}>
                {i + 1}. {line}
              </Paragraph>
            ))}
            {(event.type === 'work' || event.type === 'task') ? (
              details.startableNow ? (
                <AppButton variant="primary" alignSelf="flex-start" disabled={busy || pomodoro.isMutating} onPress={() => void start()}>
                  Empezar
                </AppButton>
              ) : (
                <Text fontSize="$2" color="$muted">
                  {event.end.getTime() <= now.getTime() ? 'Este evento ya pasó.' : 'Se puede empezar el día del evento.'}
                </Text>
              )
            ) : null}
          </Section>
        ) : null}

        {canHaveObjectives ? (
          <Section title={`Objetivos${details.objectives.length ? ` (${done}/${details.objectives.length})` : ''}`}>
            {details.objectives.length === 0 ? (
              <Paragraph margin={0} color="$muted">
                Sin objetivos todavía.
              </Paragraph>
            ) : (
              details.objectives.map((task) => (
                <XStack key={task.id} gap="$2" alignItems="center">
                  <input
                    type="checkbox"
                    checked={task.status === 'COMPLETED'}
                    disabled={busy}
                    onChange={() => void toggleObjective(task)}
                    aria-label={task.title}
                    style={{ width: 18, height: 18 }}
                  />
                  <Text flex={1} textDecorationLine={task.status === 'COMPLETED' ? 'line-through' : 'none'} color={task.status === 'COMPLETED' ? '$muted' : '$color'}>
                    {task.title}
                  </Text>
                </XStack>
              ))
            )}
            {event.type === 'work' ? (
              <XStack gap="$2" alignItems="center">
                <input
                  id="nuevo-objetivo"
                  value={newObjective}
                  placeholder="Nuevo objetivo para este bloque"
                  onChange={(e) => setNewObjective(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void addObjective();
                  }}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(128,128,128,0.35)', background: 'transparent', color: 'inherit', font: 'inherit' }}
                />
                <AppButton variant="small" disabled={busy || !newObjective.trim()} onPress={() => void addObjective()}>
                  Agregar
                </AppButton>
              </XStack>
            ) : null}
          </Section>
        ) : null}
      </YStack>
    </>
  );
}
