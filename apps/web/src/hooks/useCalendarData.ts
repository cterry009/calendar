import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../lib/api';
import { useSync } from '../context/SyncContext';
import type { SyncSnapshot } from '../lib/calendar/types';
import { useSyncRefetch } from './useSyncRefetch';

interface UseCalendarDataResult {
  tasks: SyncSnapshot['tasks'];
  schedules: SyncSnapshot['schedules'];
  pomodoroSessions: SyncSnapshot['pomodoroSessions'];
  blockListEntries: SyncSnapshot['blockListEntries'];
  focusTriggers: SyncSnapshot['focusTriggers'];
  fitnessEntries: SyncSnapshot['fitnessEntries'];
  habits: SyncSnapshot['habits'];
  scheduleCompletions: SyncSnapshot['scheduleCompletions'];
  scheduleExceptions: NonNullable<SyncSnapshot['scheduleExceptions']>;
  studyPlan?: SyncSnapshot['studyPlan'];
  habitRecords: SyncSnapshot['habitRecords'];
  /** Study game attempts (2026-10-21); empty for snapshots cached before them. */
  exerciseAttempts: NonNullable<SyncSnapshot['exerciseAttempts']>;
  /** projects-and-claude-bridge; empty for snapshots cached before them. */
  projects: NonNullable<SyncSnapshot['projects']>;
  projectLogEntries: NonNullable<SyncSnapshot['projectLogEntries']>;
  syncedAt: string | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

type CalendarSnapshot = Omit<
  SyncSnapshot,
  'syncedAt' | 'scheduleExceptions' | 'exerciseAttempts' | 'projects' | 'projectLogEntries'
> & {
  scheduleExceptions: NonNullable<SyncSnapshot['scheduleExceptions']>;
  exerciseAttempts: NonNullable<SyncSnapshot['exerciseAttempts']>;
  projects: NonNullable<SyncSnapshot['projects']>;
  projectLogEntries: NonNullable<SyncSnapshot['projectLogEntries']>;
};

const EMPTY_SNAPSHOT: CalendarSnapshot = {
  tasks: [],
  schedules: [],
  pomodoroSessions: [],
  blockListEntries: [],
  focusTriggers: [],
  fitnessEntries: [],
  dailyStepCounts: [],
  dailyFloorsClimbed: [],
  blockEvents: [],
  dailyScreenTime: [],
  dailyGameTime: [],
  dailyDesktopAppTime: [],
  detoxPlan: null,
  serotoninSession: null,
  habits: [],
  habitRecords: [],
  journalEntries: [],
  scheduleCompletions: [],
  scheduleExceptions: [],
  studyPlan: null,
  exerciseAttempts: [],
  projects: [],
  projectLogEntries: [],
};

export function useCalendarData(): UseCalendarDataResult {
  const { pullSnapshot } = useSync();
  const [snapshot, setSnapshot] = useState<CalendarSnapshot>(EMPTY_SNAPSHOT);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await pullSnapshot();
      setSnapshot({
        tasks: data.tasks,
        schedules: data.schedules,
        pomodoroSessions: data.pomodoroSessions,
        blockListEntries: data.blockListEntries,
        focusTriggers: data.focusTriggers,
        fitnessEntries: data.fitnessEntries,
        dailyStepCounts: data.dailyStepCounts,
        dailyFloorsClimbed: data.dailyFloorsClimbed,
        blockEvents: data.blockEvents,
        dailyScreenTime: data.dailyScreenTime,
        dailyGameTime: data.dailyGameTime,
        // Falls back for snapshots cached before this field existed, same reason detoxPlan below
        // coalesces -- an IndexedDB snapshot written by an older build has no key here.
        dailyDesktopAppTime: data.dailyDesktopAppTime ?? [],
        detoxPlan: data.detoxPlan ?? null,
        serotoninSession: data.serotoninSession ?? null,
        habits: data.habits,
        habitRecords: data.habitRecords,
        journalEntries: data.journalEntries,
        scheduleCompletions: data.scheduleCompletions ?? [],
        scheduleExceptions: data.scheduleExceptions ?? [],
        studyPlan: data.studyPlan ?? null,
        exerciseAttempts: data.exerciseAttempts ?? [],
        projects: data.projects ?? [],
        projectLogEntries: data.projectLogEntries ?? [],
      });
      setSyncedAt(data.syncedAt);
    } catch (errorValue) {
      if (errorValue instanceof ApiError) {
        setError(errorValue.message);
      } else if (errorValue instanceof Error) {
        setError(errorValue.message);
      } else {
        setError('No se pudieron cargar los datos del calendario.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [pullSnapshot]);

  useSyncRefetch('tasks', refetch);
  useSyncRefetch('schedules', refetch);
  useSyncRefetch('pomodoroSessions', refetch);
  useSyncRefetch('fitnessEntries', refetch);
  useSyncRefetch('detoxPlan', refetch);
  useSyncRefetch('scheduleExceptions', refetch);
  useSyncRefetch('studyPlan', refetch);
  useSyncRefetch('exerciseAttempts', refetch);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    ...snapshot,
    syncedAt,
    isLoading,
    error,
    refetch,
  };
}
