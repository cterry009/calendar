import NetInfo from '@react-native-community/netinfo';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { flushSyncQueue, subscribeSyncStatus, type SyncStatus } from '../lib/sync/api';

interface SyncContextValue extends SyncStatus {
  flushQueue: () => Promise<void>;
  // Lets a mounted screen's hook (useCalendarData, useFitness, useDashboard, PomodoroContext) ask
  // to be re-run after a queue flush succeeds, so data created/edited offline shows up on the
  // same screen once connectivity returns instead of waiting for the next mount. Deliberately
  // simpler than apps/web's per-entity registerEntityRefetch/notifyEntityChanged pub-sub (itself
  // applied inconsistently there -- useFitness never calls it) -- one "something changed, refetch
  // if you care" signal covers the real need here without porting that inconsistency too.
  registerRefetch: (refetch: () => void | Promise<void>) => () => void;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SyncStatus>({ isOnline: true, lastPullFromCache: false, pendingQueueCount: 0 });
  const refetchersRef = useRef(new Set<() => void | Promise<void>>());
  const wasOnlineRef = useRef(true);

  const runRegisteredRefetches = useCallback(() => {
    refetchersRef.current.forEach((refetch) => void refetch());
  }, []);

  const flushQueue = useCallback(async () => {
    const { flushedCount } = await flushSyncQueue();
    if (flushedCount > 0) {
      runRegisteredRefetches();
    }
  }, [runRegisteredRefetches]);

  useEffect(() => {
    // The primary, always-correct flush trigger: pullSnapshot()/syncBatch() set `isOnline` from
    // the outcome of a real request, not a connectivity pre-check -- so a false->true transition
    // here means we just confirmed, by actually talking to the server, that we're back online.
    // (NetInfo's own `online` event, used below as a secondary trigger, isn't reliable enough to
    // be the only one: on web it can miss transitions entirely when the browser's Network
    // Information API doesn't update for a given connectivity change -- verified in this exact
    // setup, see the comment in lib/sync/api.ts's pullSnapshot.)
    return subscribeSyncStatus((next) => {
      setStatus(next);
      if (next.isOnline && !wasOnlineRef.current) {
        void flushQueue();
      }
      wasOnlineRef.current = next.isOnline;
    });
  }, [flushQueue]);

  useEffect(() => {
    // Secondary triggers, best-effort: NetInfo's `online` transition (matches apps/web's
    // `window.addEventListener('online', ...)`) and AppState foreground (an addition for mobile,
    // where apps get backgrounded far more often than browser tabs get hidden -- connectivity
    // regained while backgrounded wouldn't otherwise trigger a flush until some unrelated action
    // calls pullSnapshot/syncBatch again).
    const netInfoSubscription = NetInfo.addEventListener((state) => {
      if (state.isConnected !== false) {
        void flushQueue();
      }
    });

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void flushQueue();
      }
    });

    return () => {
      netInfoSubscription();
      appStateSubscription.remove();
    };
  }, [flushQueue]);

  useEffect(() => {
    // Fallback trigger, so a queued mutation eventually flushes even if every event-based trigger
    // above misses the transition (confirmed happens on web: browser 'online'/'offline' DOM
    // events don't reliably fire just because the underlying connection changed -- see the two
    // comments above). Only does anything (a real network attempt) when there's actually
    // something queued, so this is a no-op poll the rest of the time, not a constant retry loop.
    const intervalId = setInterval(() => {
      if (status.pendingQueueCount > 0) {
        void flushQueue();
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [status.pendingQueueCount, flushQueue]);

  const registerRefetch = useCallback((refetch: () => void | Promise<void>) => {
    refetchersRef.current.add(refetch);
    return () => {
      refetchersRef.current.delete(refetch);
    };
  }, []);

  const value = useMemo<SyncContextValue>(
    () => ({ ...status, flushQueue, registerRefetch }),
    [status, flushQueue, registerRefetch],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within SyncProvider');
  }
  return context;
}
