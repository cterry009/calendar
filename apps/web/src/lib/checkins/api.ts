import { apiFetch } from '../api';

// One POST per answer. If the server is down the answer waits in localStorage and goes with the next one.

export interface CheckInInput {
  clientId: string;
  at: string;
  kind: 'fijo' | 'dinamico' | 'manual';
  energy?: number;
  napped?: boolean;
  exerciseIntensity?: 'suave' | 'medio' | 'muy-intenso';
  progress?: number;
  reason?: string;
  note?: string;
}

const QUEUE = 'calendar.checkins.queue';

function queued(): CheckInInput[] {
  try {
    return JSON.parse(window.localStorage.getItem(QUEUE) ?? '[]') as CheckInInput[];
  } catch {
    return [];
  }
}

export async function sendCheckIn(input: CheckInInput): Promise<boolean> {
  const pending = [...queued(), input];
  const left: CheckInInput[] = [];
  for (const c of pending) {
    try {
      await apiFetch('/checkins', { method: 'POST', body: JSON.stringify(c) });
    } catch {
      left.push(c);
    }
  }
  try {
    window.localStorage.setItem(QUEUE, JSON.stringify(left.slice(-50)));
  } catch {
    /* ignore */
  }
  return !left.includes(input);
}
