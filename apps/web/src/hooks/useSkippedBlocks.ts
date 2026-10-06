import { useCallback, useEffect, useState } from 'react';
import { useSync } from '../context/SyncContext';
import { useSyncRefetch } from './useSyncRefetch';

// Blocks marked "no puedo hacer este bloque" (ScheduleCompletion status SKIPPED), as
// blockOccurrenceKey ("<scheduleId>@<YYYY-MM-DD>"): no overlay, no auto-started pomodoro and no
// work-hours blocking for them that day. The phone reads the same records (lib/calendar/skips.ts).
export function useSkippedBlocks(): Set<string> {
  const { pullSnapshot } = useSync();
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());

  const refetch = useCallback(async () => {
    try {
      const snapshot = await pullSnapshot();
      setSkipped(
        new Set(
          (snapshot.scheduleCompletions ?? [])
            .filter((c) => c.status === 'SKIPPED')
            .map((c) => `${c.scheduleId}@${c.date.slice(0, 10)}`),
        ),
      );
    } catch {
      // Keep the last known set.
    }
  }, [pullSnapshot]);

  useSyncRefetch('scheduleCompletions', refetch);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return skipped;
}
