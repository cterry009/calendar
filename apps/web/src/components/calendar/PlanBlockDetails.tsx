import { useState } from 'react';
import {
  adjustmentActionsFor,
  isPlanCategory,
  PLAN_CATEGORY_INFO,
  swapExceptions,
  type ScheduleExceptionLike,
} from '@calendar/shared';
import { AppButton, Text, XStack, YStack } from '@calendar/ui';
import type { CalendarEvent } from '../../lib/calendar/types';
import { dateKey } from '../../lib/habits/today';
import { minuteToTimeValue, timeValueToMinute } from '../../lib/schedules/types';
import { categoryColor } from './eventStyles';

// Horario 2026-10-19: what a timetable block is about this week (its phase's description), its
// sequence, and the one-day changes -- "mover a carrera / datos" (reglas de ajuste as quick
// actions), another time, or swapping with another block of the day. None of them touches any
// other day: each is one ScheduleException.

export type ExceptionChange =
  | { kind: 'set'; exceptions: ScheduleExceptionLike[] }
  | { kind: 'clear'; scheduleId: string; date: string };

function minuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function PlanBlockDetails({
  block,
  dayBlocks,
  onChange,
}: {
  block: CalendarEvent;
  /** The day's other work blocks, to swap with. */
  dayBlocks: CalendarEvent[];
  onChange: (change: ExceptionChange) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState(false);
  const [startInput, setStartInput] = useState(() => minuteToTimeValue(minuteOfDay(block.start)));
  const [error, setError] = useState<string | null>(null);

  const scheduleId = block.meta?.scheduleId;
  if (!scheduleId) return null;
  const date = dateKey(block.start);
  const category = block.meta?.category ?? null;
  const segments = block.meta?.segments ?? [];
  const focusCount = segments.filter((s) => s.tipo === 'foco').length;
  const duration = minuteOfDay(block.end) - minuteOfDay(block.start);

  async function run(change: ExceptionChange) {
    setBusy(true);
    setError(null);
    try {
      await onChange(change);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el cambio.');
    } finally {
      setBusy(false);
    }
  }

  function move() {
    const start = timeValueToMinute(startInput);
    if (start === null || start + duration > 24 * 60) {
      setError('Hora no válida.');
      return;
    }
    setMoving(false);
    void run({
      kind: 'set',
      exceptions: [{ scheduleId: scheduleId!, date, category, label: block.title, startMinute: start, endMinute: start + duration }],
    });
  }

  const swapCandidates = dayBlocks.filter((other) => other.id !== block.id && other.meta?.scheduleId);

  return (
    <YStack gap="$2">
      {isPlanCategory(category) ? (
        <XStack gap="$2" alignItems="center" flexWrap="wrap">
          <YStack width={10} height={10} borderRadius={5} backgroundColor={categoryColor(category) ?? '$muted'} />
          <Text fontSize="$2" color="$muted">
            {PLAN_CATEGORY_INFO[category].name}
          </Text>
          {block.meta?.isException ? (
            <Text fontSize="$2" color="$warning">
              · cambiado solo este día
            </Text>
          ) : null}
        </XStack>
      ) : null}
      {block.meta?.description ? <Text fontSize="$3">{block.meta.description}</Text> : null}
      {segments.length ? (
        <Text fontSize="$2" color="$muted">
          {focusCount} pomodoros: {segments.map((s) => s.endOffset - s.startOffset).join(' + ')} min
        </Text>
      ) : null}
      {block.meta?.sequenceWarning ? (
        <Text fontSize="$2" color="$warning">
          {block.meta.sequenceWarning}
        </Text>
      ) : null}

      <XStack gap="$2" flexWrap="wrap" alignItems="center">
        {adjustmentActionsFor(category).map((action) => (
          <AppButton
            key={action.id}
            variant="small"
            disabled={busy}
            onPress={() =>
              void run({ kind: 'set', exceptions: [{ scheduleId, date, category: action.category, label: block.title }] })
            }
          >
            {action.label}
          </AppButton>
        ))}
        <AppButton variant="small" disabled={busy} onPress={() => setMoving((v) => !v)}>
          Mover hora
        </AppButton>
        {swapCandidates.map((other) => (
          <AppButton
            key={other.id}
            variant="small"
            disabled={busy}
            onPress={() =>
              void run({
                kind: 'set',
                exceptions: swapExceptions(
                  { scheduleId, date, category, title: block.title },
                  { scheduleId: other.meta!.scheduleId!, date, category: other.meta?.category ?? null, title: other.title },
                ),
              })
            }
          >
            Intercambiar con {minuteToTimeValue(minuteOfDay(other.start))}
          </AppButton>
        ))}
        {block.meta?.isException ? (
          <AppButton variant="small" disabled={busy} onPress={() => void run({ kind: 'clear', scheduleId, date })}>
            Volver al horario
          </AppButton>
        ) : null}
      </XStack>

      {moving ? (
        <XStack gap="$2" alignItems="center">
          <Text fontSize="$2">Empieza a las</Text>
          <input type="time" value={startInput} onChange={(e) => setStartInput(e.target.value)} />
          <Text fontSize="$2" color="$muted">
            (dura {duration} min)
          </Text>
          <AppButton variant="small" disabled={busy} onPress={move}>
            Guardar
          </AppButton>
        </XStack>
      ) : null}
      {error ? (
        <Text fontSize="$2" color="$error">
          {error}
        </Text>
      ) : null}
    </YStack>
  );
}
