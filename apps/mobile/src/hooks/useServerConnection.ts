import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { checkServer, subscribeConnection, type ConnectionStatus } from '../lib/server/connection';

// Offline: retry often so the banner clears soon after the server comes back. Online: a slow
// heartbeat is enough, since every real request also updates the status.
const OFFLINE_RETRY_MS = 30_000;
const ONLINE_HEARTBEAT_MS = 120_000;

/** Live server reachability. Pass `watch` from exactly one always-mounted place. */
export function useServerConnection(watch = false): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>(() => ({
    state: 'checking',
    url: '',
    error: null,
    lastCheckedAt: null,
  }));

  useEffect(() => subscribeConnection(setStatus), []);

  const isOnline = status.state === 'online';

  useEffect(() => {
    if (!watch) return;
    void checkServer();
    const interval = setInterval(() => void checkServer(), isOnline ? ONLINE_HEARTBEAT_MS : OFFLINE_RETRY_MS);
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void checkServer();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [watch, isOnline]);

  return status;
}
