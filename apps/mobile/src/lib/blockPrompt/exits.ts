import { clearOverlayExit } from '../focusBlock/api';
import { platformStorage } from '../platformStorage';

// Blocks the user left with "Salir" today (blockOccurrenceKey), so the pomodoro isn't started for
// them again automatically. Kept on disk: leaving the block outlives the app process.

const KEY = 'calendar:exited-blocks';
let exited: Set<string> | null = null;

async function load(): Promise<Set<string>> {
  if (exited) return exited;
  try {
    const raw = await platformStorage.getItem(KEY);
    exited = new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    exited = new Set();
  }
  return exited;
}

function save(set: Set<string>): void {
  // Only the last couple of days matter.
  const recent = [...set].slice(-50);
  void platformStorage.setItem(KEY, JSON.stringify(recent)).catch(() => undefined);
}

export async function isBlockExited(key: string): Promise<boolean> {
  return (await load()).has(key);
}

export async function markBlockExited(key: string): Promise<void> {
  const set = await load();
  set.add(key);
  save(set);
}

/** "Volver al bloque": it counts again, and the overlay may pop up again. */
export async function clearBlockExited(key: string): Promise<void> {
  const set = await load();
  set.delete(key);
  save(set);
  clearOverlayExit(key);
}
