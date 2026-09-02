import { platformStorage } from '../platformStorage';

const NIGHT_BLOCK_ENABLED_KEY = 'calendar_night_block_enabled_v1';
const NIGHT_BLOCK_WINDOW_KEY = 'calendar_night_block_window_v1';

// Task 11.22: the window used to be a fixed 22:30-08:00 constant; now user-configurable, with a
// floor so it can't be shrunk into something that no longer resembles "block overnight" (e.g. a
// 20-minute window). 10 hours matches the original window's own ~9.5h with room either side.
export const MIN_NIGHT_WINDOW_MINUTES = 10 * 60;
export const DEFAULT_NIGHT_START_MINUTES = 22 * 60 + 30;
export const DEFAULT_NIGHT_END_MINUTES = 8 * 60;

export interface NightWindow {
  startMinutes: number;
  endMinutes: number;
}

// Duration assumes the window crosses midnight (endMinutes < startMinutes as raw
// minutes-since-midnight) -- the only shape "block overnight" makes sense as. A window that
// doesn't cross midnight isn't a supported configuration; setNightWindowPersisted rejects it via
// the same >=10h check (a same-day range can't reach 600 minutes without spanning more than half
// the day, which setNightWindow's validation below catches as an invalid combination anyway).
export function nightWindowDurationMinutes(startMinutes: number, endMinutes: number): number {
  return 24 * 60 - startMinutes + endMinutes;
}

export function formatNightWindowMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Module-level singleton, same pattern as lib/sync/api.ts's subscribeSyncStatus -- this flag has
// two independent readers that must always agree instantly: the always-mounted native-push bridge
// (useNightBlocking.ts) and blocklist.tsx's own on/off switch. Off by default: night blocking
// (and the more aggressive jog-to-unlock enforcement it enables, task 11.11) shouldn't turn itself
// on just because the user added an app to the list -- it's an explicit opt-in.
let enabled = false;
let loaded = false;
const listeners = new Set<(enabled: boolean) => void>();

let window: NightWindow = { startMinutes: DEFAULT_NIGHT_START_MINUTES, endMinutes: DEFAULT_NIGHT_END_MINUTES };
let windowLoaded = false;
const windowListeners = new Set<(window: NightWindow) => void>();

function notify() {
  listeners.forEach((listener) => listener(enabled));
}

function notifyWindow() {
  windowListeners.forEach((listener) => listener(window));
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  loaded = true;
  const stored = await platformStorage.getItem(NIGHT_BLOCK_ENABLED_KEY);
  enabled = stored === 'true';
  notify();
}

async function ensureWindowLoaded(): Promise<void> {
  if (windowLoaded) return;
  windowLoaded = true;
  const stored = await platformStorage.getItem(NIGHT_BLOCK_WINDOW_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<NightWindow>;
      if (typeof parsed.startMinutes === 'number' && typeof parsed.endMinutes === 'number') {
        window = { startMinutes: parsed.startMinutes, endMinutes: parsed.endMinutes };
      }
    } catch {
      // Corrupt/unexpected stored value -- keep the default rather than crash on startup.
    }
  }
  notifyWindow();
}

export function subscribeNightBlockEnabled(listener: (enabled: boolean) => void): () => void {
  listeners.add(listener);
  listener(enabled);
  void ensureLoaded();
  return () => listeners.delete(listener);
}

export function getNightBlockEnabledSnapshot(): boolean {
  return enabled;
}

export async function setNightBlockEnabledPersisted(next: boolean): Promise<void> {
  enabled = next;
  notify();
  await platformStorage.setItem(NIGHT_BLOCK_ENABLED_KEY, next ? 'true' : 'false');
}

export function subscribeNightWindow(listener: (window: NightWindow) => void): () => void {
  windowListeners.add(listener);
  listener(window);
  void ensureWindowLoaded();
  return () => windowListeners.delete(listener);
}

export function getNightWindowSnapshot(): NightWindow {
  return window;
}

// Returns an error message (in Spanish, shown directly in the settings UI) instead of throwing --
// this is a form-validation result, not an exceptional condition. Rejects anything that doesn't
// cross midnight for the same reason nightWindowDurationMinutes's doc comment gives: it can't
// reach the 10h floor without doing so anyway, but checking explicitly gives a clearer message
// than a duration number that doesn't add up.
export async function setNightWindowPersisted(next: NightWindow): Promise<{ ok: true } | { ok: false; error: string }> {
  if (next.startMinutes <= next.endMinutes) {
    return { ok: false, error: 'La hora de inicio debe ser de noche y la de fin a la mañana siguiente.' };
  }

  const duration = nightWindowDurationMinutes(next.startMinutes, next.endMinutes);
  if (duration < MIN_NIGHT_WINDOW_MINUTES) {
    const hours = Math.round((duration / 60) * 10) / 10;
    return { ok: false, error: `La ventana debe durar al menos 10 horas (dura ${hours}h con estos valores).` };
  }

  window = next;
  notifyWindow();
  await platformStorage.setItem(NIGHT_BLOCK_WINDOW_KEY, JSON.stringify(next));
  return { ok: true };
}
