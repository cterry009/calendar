import { io, type Socket } from 'socket.io-client';
import { env } from '../env';
import { getAccessToken, loadSession } from '../auth-storage';
import type { SyncEntityType } from '../offline/types';

export interface SyncChangesEvent {
  sourceDeviceId: string;
  entities: SyncEntityType[];
  timestamp: string;
}

export type SyncChangesHandler = (event: SyncChangesEvent) => void;

let socket: Socket | null = null;
let handlers = new Set<SyncChangesHandler>();

function getSocketUrl(): string {
  return env.apiUrl;
}

export function connectSyncSocket(): Socket | null {
  const token = getAccessToken();
  if (!token) {
    return null;
  }

  if (socket?.connected) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(`${getSocketUrl()}/sync`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });

  socket.on('sync:changes', (payload: SyncChangesEvent) => {
    const session = loadSession();
    if (session && payload.sourceDeviceId === session.deviceId) {
      return;
    }

    for (const handler of handlers) {
      handler(payload);
    }
  });

  socket.on('connect_error', () => {
    // Socket.io will retry; offline sync queue handles mutations.
  });

  return socket;
}

export function disconnectSyncSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function subscribeSyncChanges(handler: SyncChangesHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

export function reconnectSyncSocket(): void {
  disconnectSyncSocket();
  connectSyncSocket();
}
