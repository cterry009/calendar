import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { MoodState, SerotoninPillar, SerotoninRitual, SerotoninSession } from '@calendar/shared';
import {
  completeRitual,
  createSerotoninSession,
  logMood,
  logPillarActivity,
  recordTemptationAvoided,
} from '@calendar/shared';
import type { StoredSerotoninDay } from '../lib/calendar/types';
import { cacheServerSerotoninSession, loadTodaySerotoninSession, saveSerotoninSession, todayKey } from '../lib/offline/serotonin-store';
import { buildUpsertSerotoninSessionPayload, syncSerotoninSessionBatch } from '../lib/serotonin/sync';
import { useSync } from './SyncContext';
import { useSyncRefetch } from '../hooks/useSyncRefetch';

interface SerotoninSessionContextValue {
  session: SerotoninSession | null;
  onRitual: (ritual: SerotoninRitual) => void;
  onPillar: (pillar: SerotoninPillar, minutes: number) => void;
  onMood: (mood: MoodState) => void;
  onTemptationAvoided: () => void;
}

const SerotoninSessionContext = createContext<SerotoninSessionContextValue | null>(null);

/**
 * Wellness tracking (pillars/rituals/mood) runs by default, every day -- there is no on/off
 * toggle. Today's session is pulled from the server on mount (same pattern as `useDetoxPlan`:
 * server wins if it has today's record, otherwise fall back to the local IndexedDB cache, and
 * only create a brand-new session if neither has one for today) and pushed to the server on
 * every change so it's the same session across devices, not just this browser.
 *
 * Lives as a context (not a plain hook) because both the calendar's wellness card and the
 * ritual panel (5.2) need to read and complete rituals against the *same* session instance --
 * two independent hook instances would each load their own copy and drift.
 */
export function SerotoninSessionProvider({ children }: { children: ReactNode }) {
  const { pullSnapshot } = useSync();
  const [session, setSession] = useState<SerotoninSession | null>(null);
  const [serverRecordId, setServerRecordId] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    try {
      const snapshot = await pullSnapshot();
      const record = snapshot.serotoninSession;

      if (record && record.sessionData?.date === todayKey()) {
        await cacheServerSerotoninSession(record.sessionData);
        setSession(record.sessionData.session);
        setServerRecordId(record.id);
        return;
      }

      const local = await loadTodaySerotoninSession();
      if (local) {
        setSession(local);
        setServerRecordId(null);
        return;
      }

      const fresh = createSerotoninSession(crypto.randomUUID());
      await saveSerotoninSession(fresh);
      setSession(fresh);
      setServerRecordId(null);
    } catch {
      const local = await loadTodaySerotoninSession();
      if (local) {
        setSession(local);
        return;
      }
      const fresh = createSerotoninSession(crypto.randomUUID());
      await saveSerotoninSession(fresh);
      setSession(fresh);
    }
  }, [pullSnapshot]);

  useSyncRefetch('serotoninSession', loadSession);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const persist = useCallback(
    async (nextSession: SerotoninSession) => {
      await saveSerotoninSession(nextSession);

      const day: StoredSerotoninDay = { date: todayKey(), session: nextSession };
      try {
        const response = await syncSerotoninSessionBatch([
          buildUpsertSerotoninSessionPayload(day, serverRecordId),
        ]);
        const appliedRecord = response.applied?.serotoninSession?.[0] as
          | { record?: { id?: string } }
          | undefined;
        if (appliedRecord?.record?.id) {
          setServerRecordId(appliedRecord.record.id);
        }
      } catch {
        // Offline or request failed -- syncBatch already queued the change locally; the next
        // successful pull/flush will reconcile it, same as every other synced entity.
      }
    },
    [serverRecordId],
  );

  const update = useCallback(
    (updater: (session: SerotoninSession) => SerotoninSession) => {
      setSession((previous) => {
        if (!previous) return previous;
        const next = updater(previous);
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  const onRitual = useCallback((ritual: SerotoninRitual) => update((s) => completeRitual(s, ritual)), [update]);
  const onPillar = useCallback(
    (pillar: SerotoninPillar, minutes: number) => update((s) => logPillarActivity(s, pillar, minutes)),
    [update],
  );
  const onMood = useCallback((mood: MoodState) => update((s) => logMood(s, mood)), [update]);
  const onTemptationAvoided = useCallback(() => update((s) => recordTemptationAvoided(s)), [update]);

  const value = useMemo<SerotoninSessionContextValue>(
    () => ({ session, onRitual, onPillar, onMood, onTemptationAvoided }),
    [session, onRitual, onPillar, onMood, onTemptationAvoided],
  );

  return <SerotoninSessionContext.Provider value={value}>{children}</SerotoninSessionContext.Provider>;
}

export function useSerotoninSession(): SerotoninSessionContextValue {
  const context = useContext(SerotoninSessionContext);
  if (!context) {
    throw new Error('useSerotoninSession must be used within SerotoninSessionProvider');
  }
  return context;
}
