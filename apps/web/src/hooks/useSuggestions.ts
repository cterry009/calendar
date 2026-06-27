import { calculateEstimationAccuracy, generateSuggestions, type Suggestion } from '@calendar/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../lib/api';
import { useSync } from '../context/SyncContext';
import { buildSuggestionInput } from '../lib/analytics/build-suggestion-input';
import { seedDemoData } from '../lib/analytics/seed-demo';
import { useSyncRefetch } from './useSyncRefetch';

interface UseSuggestionsResult {
  suggestions: Suggestion[];
  isLoading: boolean;
  isSeeding: boolean;
  error: string | null;
  syncedAt: string | null;
  refetch: () => Promise<void>;
  seedDemo: () => Promise<void>;
}

export function useSuggestions(): UseSuggestionsResult {
  const { pullSnapshot } = useSync();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const snapshot = await pullSnapshot();
      const completedWithActual = snapshot.tasks.filter(
        (task) => task.status === 'COMPLETED' && task.actualMinutes !== null,
      );
      const estimationRecords = completedWithActual.map((task) => ({
        difficulty: task.difficulty,
        estimatedMinutes: task.estimatedMinutes,
        actualMinutes: task.actualMinutes ?? task.estimatedMinutes,
      }));
      const estimationAccuracy = calculateEstimationAccuracy(estimationRecords);

      setSuggestions(
        generateSuggestions({
          ...buildSuggestionInput(snapshot),
          estimationByDifficulty: estimationAccuracy.byDifficulty,
        }),
      );
      setSyncedAt(snapshot.syncedAt);
    } catch (errorValue) {
      if (errorValue instanceof ApiError) {
        setError(errorValue.message);
      } else if (errorValue instanceof Error) {
        setError(errorValue.message);
      } else {
        setError('No se pudieron cargar las sugerencias.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [pullSnapshot]);

  useSyncRefetch('tasks', refetch);
  useSyncRefetch('pomodoroSessions', refetch);
  useSyncRefetch('fitnessEntries', refetch);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const seedDemo = useCallback(async () => {
    setIsSeeding(true);
    setError(null);

    try {
      await seedDemoData();
      await refetch();
    } catch (errorValue) {
      if (errorValue instanceof ApiError) {
        setError(errorValue.message);
      } else {
        setError('No se pudieron generar datos de ejemplo.');
      }
      throw errorValue;
    } finally {
      setIsSeeding(false);
    }
  }, [refetch]);

  return useMemo(
    () => ({
      suggestions,
      isLoading,
      isSeeding,
      error,
      syncedAt,
      refetch,
      seedDemo,
    }),
    [error, isLoading, isSeeding, refetch, seedDemo, suggestions, syncedAt],
  );
}
