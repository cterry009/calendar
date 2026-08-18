import { useCallback, useEffect, useMemo, useState } from 'react';
import { computeHabitScore } from '@calendar/shared';
import { ApiError } from '../lib/api';
import { useSync } from '../context/SyncContext';
import {
  buildArchiveHabitPayload,
  buildCheckInPayload,
  buildCreateHabitPayload,
  buildCreateJournalEntryPayload,
  buildDeleteCheckInPayload,
  buildDeleteHabitPayload,
  buildDeleteJournalEntryPayload,
  buildUpdateHabitPayload,
  buildUpdateJournalEntryPayload,
  syncHabitBatch,
  syncHabitRecordBatch,
  syncJournalEntryBatch,
} from '../lib/habits/sync';
import { findRecordForDate } from '../lib/habits/today';
import type {
  HabitCheckInValues,
  HabitFormValues,
  SyncHabit,
  SyncHabitRecord,
  SyncJournalEntry,
} from '../lib/habits/types';
import { useSyncRefetch } from './useSyncRefetch';

export interface HabitWithScore extends SyncHabit {
  score: number;
}

interface UseHabitsResult {
  habits: HabitWithScore[];
  records: SyncHabitRecord[];
  journalEntries: SyncJournalEntry[];
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  syncedAt: string | null;
  refetch: () => Promise<void>;
  createHabit: (values: HabitFormValues) => Promise<void>;
  updateHabit: (habitId: string, values: HabitFormValues) => Promise<void>;
  archiveHabit: (habitId: string, archived: boolean) => Promise<void>;
  deleteHabit: (habitId: string) => Promise<void>;
  checkIn: (habitId: string, values: HabitCheckInValues) => Promise<void>;
  deleteCheckIn: (recordId: string) => Promise<void>;
  recordsForHabit: (habitId: string) => SyncHabitRecord[];
  addJournalEntry: (habitId: string, content: string, recordId?: string) => Promise<void>;
  updateJournalEntry: (entryId: string, content: string) => Promise<void>;
  deleteJournalEntry: (entryId: string) => Promise<void>;
  journalEntriesForHabit: (habitId: string) => SyncJournalEntry[];
}

export function useHabits(): UseHabitsResult {
  const { pullSnapshot } = useSync();
  const [habits, setHabits] = useState<SyncHabit[]>([]);
  const [records, setRecords] = useState<SyncHabitRecord[]>([]);
  const [journalEntries, setJournalEntries] = useState<SyncJournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await pullSnapshot();
      setHabits(data.habits);
      setRecords(data.habitRecords);
      setJournalEntries(data.journalEntries);
      setSyncedAt(data.syncedAt);
    } catch (errorValue) {
      if (errorValue instanceof ApiError || errorValue instanceof Error) {
        setError(errorValue.message);
      } else {
        setError('No se pudieron cargar los habitos.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [pullSnapshot]);

  useSyncRefetch('habits', refetch);
  useSyncRefetch('habitRecords', refetch);
  useSyncRefetch('journalEntries', refetch);

  useEffect(() => {
    void refetch();
  }, [refetch]);

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

  const updateHabit = useCallback(
    (habitId: string, values: HabitFormValues) =>
      runMutation(() => syncHabitBatch([buildUpdateHabitPayload(habitId, values)]), 'No se pudo guardar el habito.'),
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

  const deleteCheckIn = useCallback(
    (recordId: string) =>
      runMutation(() => syncHabitRecordBatch([buildDeleteCheckInPayload(recordId)]), 'No se pudo quitar el registro.'),
    [runMutation],
  );

  const recordsForHabit = useCallback(
    (habitId: string) => records.filter((record) => record.habitId === habitId),
    [records],
  );

  const addJournalEntry = useCallback(
    (habitId: string, content: string, recordId?: string) =>
      runMutation(
        () => syncJournalEntryBatch([buildCreateJournalEntryPayload(habitId, content, recordId)]),
        'No se pudo guardar la nota.',
      ),
    [runMutation],
  );

  const updateJournalEntry = useCallback(
    (entryId: string, content: string) =>
      runMutation(
        () => syncJournalEntryBatch([buildUpdateJournalEntryPayload(entryId, content)]),
        'No se pudo actualizar la nota.',
      ),
    [runMutation],
  );

  const deleteJournalEntry = useCallback(
    (entryId: string) =>
      runMutation(
        () => syncJournalEntryBatch([buildDeleteJournalEntryPayload(entryId)]),
        'No se pudo eliminar la nota.',
      ),
    [runMutation],
  );

  const journalEntriesForHabit = useCallback(
    (habitId: string) =>
      journalEntries
        .filter((entry) => entry.habitId === habitId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [journalEntries],
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
      journalEntries,
      isLoading,
      isMutating,
      error,
      syncedAt,
      refetch,
      createHabit,
      updateHabit,
      archiveHabit,
      deleteHabit,
      checkIn,
      deleteCheckIn,
      recordsForHabit,
      addJournalEntry,
      updateJournalEntry,
      deleteJournalEntry,
      journalEntriesForHabit,
    }),
    [
      habitsWithScore,
      records,
      journalEntries,
      isLoading,
      isMutating,
      error,
      syncedAt,
      refetch,
      createHabit,
      updateHabit,
      archiveHabit,
      deleteHabit,
      checkIn,
      deleteCheckIn,
      recordsForHabit,
      addJournalEntry,
      updateJournalEntry,
      deleteJournalEntry,
      journalEntriesForHabit,
    ],
  );
}
