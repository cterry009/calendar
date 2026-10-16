import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSync } from '../context/SyncContext';
import { buildDayAgenda, type AgendaBlock } from '../lib/calendar/dayAgenda';
import type { SyncScheduleCompletion, SyncSnapshot } from '../lib/calendar/types';
import { dateKey } from '../lib/habits/today';
import type { SyncHabitRecord } from '../lib/habits/types';
import { clearBlockMark, markBlockSkipped } from '../lib/calendar/skips';
import { pullSnapshot, syncBatch } from '../lib/sync/api';
import { clearScheduleException, planOf, saveScheduleException, toExceptionLikes } from '../lib/plan/api';
import { swapExceptions, type ScheduleExceptionLike, type StudyPlanData } from '@calendar/shared';

type AgendaData = Pick<SyncSnapshot, 'schedules' | 'habits' | 'habitRecords' | 'tasks'> & {
  scheduleCompletions: SyncScheduleCompletion[];
  exceptions: ScheduleExceptionLike[];
  plan: StudyPlanData | null;
};

const EMPTY: AgendaData = {
  schedules: [],
  habits: [],
  habitRecords: [],
  tasks: [],
  scheduleCompletions: [],
  exceptions: [],
  plan: null,
};

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * The day's agenda plus "marcar hecho". The toggle is applied to local state first, so the check
 * shows instantly and survives an offline tap (syncBatch queues it; a refetch would otherwise
 * return the stale cached snapshot and revert it -- the same trap useHabits' checkIn documents).
 */
export function useDayAgenda(date: Date) {
  const { registerRefetch } = useSync();
  const [data, setData] = useState<AgendaData>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const snapshot = await pullSnapshot();
      setData({
        schedules: snapshot.schedules,
        habits: snapshot.habits ?? [],
        habitRecords: snapshot.habitRecords ?? [],
        tasks: snapshot.tasks,
        scheduleCompletions: snapshot.scheduleCompletions ?? [],
        exceptions: toExceptionLikes(snapshot.scheduleExceptions),
        plan: planOf(snapshot),
      });
    } catch {
      // No server and no cache: keep what's on screen.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => registerRefetch(refetch), [registerRefetch, refetch]);

  const blocks = useMemo(() => buildDayAgenda(date, data), [date, data]);

  /**
   * "Mover a carrera / datos" (reglas de ajuste) for this day only, or back to the template: one
   * ScheduleException, shown at once (local state first, same as toggleDone).
   */
  const applyExceptions = useCallback(
    async (blockId: string, change: { set: ScheduleExceptionLike[] } | { clear: string }) => {
      const key = dateKey(date);
      setBusyId(blockId);
      try {
        if ('clear' in change) {
          const scheduleId = change.clear;
          setData((current) => ({
            ...current,
            exceptions: current.exceptions.filter((e) => !(e.scheduleId === scheduleId && e.date === key)),
          }));
          await clearScheduleException(scheduleId, key);
          return;
        }
        const touched = new Set(change.set.map((e) => e.scheduleId));
        setData((current) => ({
          ...current,
          exceptions: [...current.exceptions.filter((e) => !(touched.has(e.scheduleId) && e.date === key)), ...change.set],
        }));
        for (const exception of change.set) await saveScheduleException(exception, randomId());
      } finally {
        setBusyId(null);
      }
    },
    [date],
  );

  /** "Mover a carrera / datos" for this day only, or (null) back to the template. */
  const setBlockCategory = useCallback(
    async (block: AgendaBlock, category: string | null) => {
      if (block.target?.kind !== 'schedule') return;
      const scheduleId = block.target.scheduleId;
      await applyExceptions(
        block.id,
        category === null ? { clear: scheduleId } : { set: [{ scheduleId, date: dateKey(date), category, label: block.title }] },
      );
    },
    [applyExceptions, date],
  );

  /** Another start time for this day; the block keeps its length. */
  const moveBlock = useCallback(
    async (block: AgendaBlock, startMinute: number) => {
      if (block.target?.kind !== 'schedule') return;
      const length = block.endMinute - block.startMinute;
      await applyExceptions(block.id, {
        set: [
          {
            scheduleId: block.target.scheduleId,
            date: dateKey(date),
            category: block.category ?? null,
            label: block.title,
            startMinute,
            endMinute: startMinute + length,
          },
        ],
      });
    },
    [applyExceptions, date],
  );

  /** Swaps what two blocks of the day are about; each keeps its time (shared swapExceptions). */
  const swapBlocks = useCallback(
    async (a: AgendaBlock, b: AgendaBlock) => {
      if (a.target?.kind !== 'schedule' || b.target?.kind !== 'schedule') return;
      const key = dateKey(date);
      await applyExceptions(a.id, {
        set: swapExceptions(
          { scheduleId: a.target.scheduleId, date: key, category: a.category ?? null, title: a.title },
          { scheduleId: b.target.scheduleId, date: key, category: b.category ?? null, title: b.title },
        ),
      });
    },
    [applyExceptions, date],
  );

  const toggleDone = useCallback(
    async (block: AgendaBlock) => {
      const target = block.target;
      if (!target) return;
      const key = dateKey(date);
      const now = new Date().toISOString();
      setBusyId(block.id);

      try {
        if (target.kind === 'schedule') {
          if (block.done) {
            setData((current) => ({
              ...current,
              scheduleCompletions: current.scheduleCompletions.filter(
                (c) => !(c.scheduleId === target.scheduleId && dateKey(c.date) === key),
              ),
            }));
            await syncBatch({
              scheduleCompletions: [{ updatedAt: now, deleted: true, scheduleId: target.scheduleId, date: key }],
            });
          } else {
            const clientId = randomId();
            setData((current) => ({
              ...current,
              scheduleCompletions: [
                ...current.scheduleCompletions,
                { id: `pending-${clientId}`, scheduleId: target.scheduleId, date: `${key}T00:00:00.000Z`, clientId, updatedAt: now },
              ],
            }));
            await syncBatch({
              scheduleCompletions: [{ clientId, updatedAt: now, scheduleId: target.scheduleId, date: key }],
            });
          }
          return;
        }

        // Habit: that day's HabitRecord, the same one the Habitos screen checks in.
        const serverId = target.recordId && !target.recordId.startsWith('pending-') ? target.recordId : undefined;
        if (block.done) {
          setData((current) => ({
            ...current,
            habitRecords: current.habitRecords.filter(
              (r) => !(r.habitId === target.habitId && dateKey(r.date) === key),
            ),
          }));
          if (serverId) {
            await syncBatch({ habitRecords: [{ id: serverId, deleted: true, updatedAt: now }] });
          }
        } else {
          const optimistic: SyncHabitRecord = {
            id: serverId ?? `pending-${target.habitId}-${key}`,
            habitId: target.habitId,
            date: `${key}T00:00:00.000Z`,
            value: 1,
            status: 'DONE',
            autoCompleted: false,
            fitnessEntryId: null,
            createdAt: now,
            updatedAt: now,
          };
          setData((current) => ({
            ...current,
            habitRecords: [
              ...current.habitRecords.filter((r) => !(r.habitId === target.habitId && dateKey(r.date) === key)),
              optimistic,
            ],
          }));
          await syncBatch({
            habitRecords: [
              {
                id: serverId,
                clientId: serverId ? undefined : randomId(),
                updatedAt: now,
                habitId: target.habitId,
                date: key,
                value: 1,
                status: 'DONE',
              },
            ],
          });
        }
      } finally {
        setBusyId(null);
      }
    },
    [date],
  );

  // "No puedo hacer este bloque" for that day, or undo it. Same optimistic shape as toggleDone.
  const toggleSkip = useCallback(
    async (block: AgendaBlock) => {
      const target = block.target;
      if (target?.kind !== 'schedule') return;
      const key = dateKey(date);
      const now = new Date().toISOString();
      const others = (list: SyncScheduleCompletion[]) =>
        list.filter((c) => !(c.scheduleId === target.scheduleId && dateKey(c.date) === key));
      setBusyId(block.id);
      try {
        if (block.skipped) {
          setData((current) => ({ ...current, scheduleCompletions: others(current.scheduleCompletions) }));
          await clearBlockMark(target.scheduleId, date);
        } else {
          setData((current) => ({
            ...current,
            scheduleCompletions: [
              ...others(current.scheduleCompletions),
              { id: `pending-${randomId()}`, scheduleId: target.scheduleId, date: `${key}T00:00:00.000Z`, status: 'SKIPPED', clientId: null, updatedAt: now },
            ],
          }));
          await markBlockSkipped(target.scheduleId, date);
        }
      } finally {
        setBusyId(null);
      }
    },
    [date],
  );

  return { blocks, isLoading, busyId, toggleDone, toggleSkip, setBlockCategory, moveBlock, swapBlocks, refetch };
}
