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
import { pullSnapshot } from '../lib/sync/api';

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

  const runMutation = useCallback(
    async (fn: () => Promise<unknown>, fallbackMessage: string) => {
      setIsMutating(true);
      setError(null);

      try {
        await fn();
        await refetch();
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
    (values: HabitFormValues) =>
      runMutation(() => syncHabitBatch([buildCreateHabitPayload(values)]), 'No se pudo crear el habito.'),
    [runMutation],
  );

  const archiveHabit = useCallback(
    (habitId: string, archived: boolean) =>
      runMutation(
        () => syncHabitBatch([buildArchiveHabitPayload(habitId, archived)]),
        'No se pudo archivar el habito.',
      ),
    [runMutation],
  );

  const deleteHabit = useCallback(
    (habitId: string) =>
      runMutation(() => syncHabitBatch([buildDeleteHabitPayload(habitId)]), 'No se pudo eliminar el habito.'),
    [runMutation],
  );

  const checkIn = useCallback(
    (habitId: string, values: HabitCheckInValues) => {
      const existing = findRecordForDate(records, habitId, values.date.slice(0, 10));
      return runMutation(
        () => syncHabitRecordBatch([buildCheckInPayload(habitId, values, existing?.id)]),
        'No se pudo registrar el habito.',
      );
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
