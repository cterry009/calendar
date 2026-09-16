import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { computeHabitScore } from '@calendar/shared';
import { useSync } from '../context/SyncContext';
import { ApiError } from '../lib/auth/api';
import {
  buildArchiveHabitPayload,
  buildCheckInPayload,
  buildCreateHabitPayload,
  buildDeleteHabitPayload,
  syncHabitBatch,
  syncHabitRecordBatch,
} from '../lib/habits/sync';
import { findRecordForDate } from '../lib/habits/today';
import type { HabitCheckInValues, HabitFormValues, SyncHabit, SyncHabitRecord } from '../lib/habits/types';
import { pullSnapshot, type SyncBatchResponse } from '../lib/sync/api';

export interface HabitWithScore extends SyncHabit {
  score: number;
}

interface UseHabitsResult {
  habits: HabitWithScore[];
  records: SyncHabitRecord[];
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createHabit: (values: HabitFormValues) => Promise<void>;
  archiveHabit: (habitId: string, archived: boolean) => Promise<void>;
  deleteHabit: (habitId: string) => Promise<void>;
  checkIn: (habitId: string, values: HabitCheckInValues) => Promise<void>;
  recordsForHabit: (habitId: string) => SyncHabitRecord[];
}

// Mirrors apps/web/src/hooks/useHabits.ts, trimmed to what the mobile list/quick-add/check-in
// screen needs (task 11.4) -- no update-habit or journal-entry support, same "compact first
// slice" scope useBlockList.ts already used for this port. Follows useBlockList.ts's
// registerRefetch/pullSnapshot pattern rather than web's useSyncRefetch, since that's mobile's
// own SyncContext shape.
export function useHabits(): UseHabitsResult {
  const { registerRefetch } = useSync();
  const [habits, setHabits] = useState<SyncHabit[]>([]);
  const [records, setRecords] = useState<SyncHabitRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const snapshot = await pullSnapshot();
      setHabits(snapshot.habits);
      setRecords(snapshot.habitRecords);
    } catch (errorValue) {
      setError(errorValue instanceof ApiError ? errorValue.message : 'No se pudieron cargar los habitos.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => registerRefetch(refetch), [registerRefetch, refetch]);

  // Same fix as checkIn below (and useCalendarData/useFitness/useBlockList's equivalents):
  // syncHabitBatch() never rejects when offline (or when an online request fails) -- it queues the
  // change and resolves successfully -- so a plain refetch() afterwards would silently revert to
  // the stale pre-change list. When the mutation only got queued, patch `habits` directly instead
  // of trusting a refetch that can't reflect a change the server never received yet.
  const runMutation = useCallback(
    async (
      fn: () => Promise<SyncBatchResponse>,
      fallbackMessage: string,
      applyOptimistically?: (current: SyncHabit[]) => SyncHabit[],
    ) => {
      setIsMutating(true);
      setError(null);

      try {
        const response = await fn();
        if (response.queued && applyOptimistically) {
          setHabits(applyOptimistically);
        } else {
          await refetch();
        }
      } catch (errorValue) {
        setError(errorValue instanceof ApiError ? errorValue.message : fallbackMessage);
        throw errorValue;
      } finally {
        setIsMutating(false);
      }
    },
    [refetch],
  );

  const createHabit = useCallback(
    (values: HabitFormValues) => {
      const nowIso = new Date().toISOString();
      const optimisticHabit: SyncHabit = {
        id: `pending-${Crypto.randomUUID()}`,
        clientId: null,
        title: values.title.trim(),
        description: values.description?.trim() || null,
        type: values.type,
        dailyGoalValue: values.dailyGoalValue,
        dailyGoalUnit: values.dailyGoalUnit.trim() || 'veces',
        dailyGoalExtraValue: values.dailyGoalExtraValue ?? null,
        targetDays: values.targetDays,
        color: values.color ?? null,
        category: values.category?.trim() || null,
        archived: false,
        linkedFitnessActivityType: values.linkedFitnessActivityType?.trim() || null,
        reminderStartMinute: values.reminderStartMinute ?? null,
        reminderEndMinute: values.reminderEndMinute ?? null,
        reminderDaysOfWeek: values.reminderDaysOfWeek ?? [],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      return runMutation(
        () => syncHabitBatch([buildCreateHabitPayload(values)]),
        'No se pudo crear el habito.',
        (current) => [...current, optimisticHabit],
      );
    },
    [runMutation],
  );

  const archiveHabit = useCallback(
    (habitId: string, archived: boolean) =>
      runMutation(
        () => syncHabitBatch([buildArchiveHabitPayload(habitId, archived)]),
        'No se pudo archivar el habito.',
        (current) => current.map((habit) => (habit.id === habitId ? { ...habit, archived } : habit)),
      ),
    [runMutation],
  );

  const deleteHabit = useCallback(
    (habitId: string) =>
      runMutation(
        () => syncHabitBatch([buildDeleteHabitPayload(habitId)]),
        'No se pudo eliminar el habito.',
        (current) => current.filter((habit) => habit.id !== habitId),
      ),
    [runMutation],
  );

  // Real bug found and fixed: `syncBatch()` never rejects when offline (or when an online request
  // fails) -- it queues the change and resolves successfully (see lib/sync/api.ts) -- so
  // `runMutation`'s `refetch()` above always ran, but `pullSnapshot()` falls back to the *cached*
  // (pre-change) snapshot in exactly that case. Net effect: tapping a habit's checkbox while
  // offline briefly showed the busy state, then silently reverted to unchecked, indistinguishable
  // from the tap doing nothing at all -- even though the check-in was correctly queued and would
  // land once back online. Fixed by re-applying our own optimistic record on top of whatever
  // `refetch()` returned: a no-op when the fresh/cached data already reflects it (the normal
  // online case), a real correction when it doesn't (offline or a flaky connection).
  const checkIn = useCallback(
    (habitId: string, values: HabitCheckInValues) => {
      const dateKeyStr = values.date.slice(0, 10);
      const existing = findRecordForDate(records, habitId, dateKeyStr);
      const optimisticRecord: SyncHabitRecord = {
        id: existing?.id ?? `pending-${habitId}-${dateKeyStr}`,
        habitId,
        date: values.date,
        value: values.value,
        status: values.status,
        autoCompleted: existing?.autoCompleted ?? false,
        fitnessEntryId: existing?.fitnessEntryId ?? null,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Only a real server id may go into the sync payload as `id`. A `pending-*` id is a
      // local-only placeholder for an optimistic record that never reached the server (see the
      // optimisticRecord above); sending it as `id` makes the server look up a row that doesn't
      // exist, fall through to create(), and hit the @@unique([habitId, date]) constraint (P2002)
      // when a record for that habit/day already synced under a different id -- which stalls the
      // whole offline queue. Passing undefined instead makes buildCheckInPayload attach a fresh
      // clientId, the path the server already merges by habitId+date.
      const serverId = existing?.id && !existing.id.startsWith('pending-') ? existing.id : undefined;

      return runMutation(
        () => syncHabitRecordBatch([buildCheckInPayload(habitId, values, serverId)]),
        'No se pudo registrar el habito.',
      ).then(() => {
        setRecords((current) => {
          const postRefetch = findRecordForDate(current, habitId, dateKeyStr);
          if (postRefetch && postRefetch.status === values.status && postRefetch.value === values.value) {
            return current; // refetch already reflects our change (the normal online case)
          }
          if (postRefetch) {
            return current.map((record) => (record.id === postRefetch.id ? optimisticRecord : record));
          }
          return [...current, optimisticRecord];
        });
      });
    },
    [records, runMutation],
  );

  const recordsForHabit = useCallback(
    (habitId: string) => records.filter((record) => record.habitId === habitId),
    [records],
  );

  const habitsWithScore = useMemo<HabitWithScore[]>(
    () =>
      habits.map((habit) => ({
        ...habit,
        score: computeHabitScore({
          type: habit.type,
          targetDays: habit.targetDays,
          dailyGoalValue: habit.dailyGoalValue,
          dailyGoalExtraValue: habit.dailyGoalExtraValue,
          createdAt: habit.createdAt,
          records: records
            .filter((record) => record.habitId === habit.id)
            .map((record) => ({
              date: record.date,
              value: record.value,
              status: record.status,
              autoCompleted: record.autoCompleted,
            })),
        }),
      })),
    [habits, records],
  );

  return useMemo(
    () => ({
      habits: habitsWithScore,
      records,
      isLoading,
      isMutating,
      error,
      refetch,
      createHabit,
      archiveHabit,
      deleteHabit,
      checkIn,
      recordsForHabit,
    }),
    [habitsWithScore, records, isLoading, isMutating, error, refetch, createHabit, archiveHabit, deleteHabit, checkIn, recordsForHabit],
  );
}
