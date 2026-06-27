import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { SyncSnapshot } from '../lib/calendar/types';
import {
  flushSyncQueue,
  getSyncQueue,
  isBrowserOnline,
  pullSnapshot as pullSnapshotFromClient,
  syncBatch,
} from '../lib/offline/sync-client';
import type { SyncBatchBody, SyncBatchResponse, SyncEntityType } from '../lib/offline/types';
import {
  connectSyncSocket,
  disconnectSyncSocket,
  reconnectSyncSocket,
  subscribeSyncChanges,
} from '../lib/realtime/sync-socket';
import { useAuth } from './AuthContext';

type EntityRefetchHandler = () => void | Promise<void>;

interface SyncContextValue {
  isOnline: boolean;
  pendingQueueCount: number;
  lastPullFromCache: boolean;
  pullSnapshot: () => Promise<SyncSnapshot>;
  batchSync: (body: SyncBatchBody) => Promise<SyncBatchResponse>;
  flushQueue: () => Promise<number>;
  registerEntityRefetch: (entity: SyncEntityType, handler: EntityRefetchHandler) => () => void;
}

const SyncContext = createContext<SyncContextValue | undefined>(undefined);

export function SyncProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [isOnline, setIsOnline] = useState(isBrowserOnline());
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [lastPullFromCache, setLastPullFromCache] = useState(false);
  const refetchHandlers = useRef(new Map<SyncEntityType, Set<EntityRefetchHandler>>());

  const refreshQueueCount = useCallback(async () => {
    const queue = await getSyncQueue();
    setPendingQueueCount(queue.length);
  }, []);

  const registerEntityRefetch = useCallback((entity: SyncEntityType, handler: EntityRefetchHandler) => {
    const handlers = refetchHandlers.current.get(entity) ?? new Set<EntityRefetchHandler>();
    handlers.add(handler);
    refetchHandlers.current.set(entity, handlers);

    return () => {
      const current = refetchHandlers.current.get(entity);
      current?.delete(handler);
    };
  }, []);

  const pullSnapshot = useCallback(async () => {
    const result = await pullSnapshotFromClient();
    setLastPullFromCache(result.fromCache);
    return result.snapshot;
  }, []);

  const batchSyncFn = useCallback(
    async (body: SyncBatchBody) => {
      const response = await syncBatch(body);
      await refreshQueueCount();
      return response;
    },
    [refreshQueueCount],
  );

  const flushQueueFn = useCallback(async () => {
    const flushed = await flushSyncQueue();
    await refreshQueueCount();
    return flushed;
  }, [refreshQueueCount]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void flushQueueFn();
      reconnectSyncSocket();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [flushQueueFn]);

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSyncSocket();
      return;
    }

    connectSyncSocket();
    void refreshQueueCount();

    const unsubscribe = subscribeSyncChanges((event) => {
      for (const entity of event.entities) {
        const handlers = refetchHandlers.current.get(entity);
        if (!handlers) continue;
        for (const handler of handlers) {
          void handler();
        }
      }
    });

    return () => {
      unsubscribe();
      disconnectSyncSocket();
    };
  }, [isAuthenticated, refreshQueueCount]);

  const value = useMemo<SyncContextValue>(
    () => ({
      isOnline,
      pendingQueueCount,
      lastPullFromCache,
      pullSnapshot,
      batchSync: batchSyncFn,
      flushQueue: flushQueueFn,
      registerEntityRefetch,
    }),
    [batchSyncFn, flushQueueFn, isOnline, lastPullFromCache, pendingQueueCount, pullSnapshot, registerEntityRefetch],
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
