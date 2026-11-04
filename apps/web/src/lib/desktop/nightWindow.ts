import {
  DEFAULT_WEEKEND_NIGHT_START,
  MIN_NIGHT_WINDOW_HOURS,
  upcomingNightStart,
  validateNightStart,
  type NightWarningTarget,
} from '@calendar/shared';

// Desktop counterpart of apps/mobile/src/lib/nightBlock/state.ts. Deliberately a separate, small
// implementation rather than sharing mobile's module: that one is entangled with native storage
// and a native bridge this platform doesn't have. The math (is `now` inside a possibly-midnight-
// wrapping window) is simple enough that duplicating it is safer than forcing a refactor of
// mobile's working code.
//
// User-configurable like mobile's (task 11.22): an on/off switch and the window itself, with the
// same rules -- the window must cross midnight and have a minimum length (see below). Stored per device in
// localStorage, the same as mobile keeps its own in device storage; the two are not synced.
//
// **On by default here, unlike mobile.** Before this was configurable, desktop always enforced
// NIGHT entries in the fixed 22:30-08:00 window. Defaulting to off would silently stop blocks the
// user had already set up, so an unset value keeps the old behaviour.
// 22:00-08:00 since 2026-10-15 (was 22:30-08:00).
export const DEFAULT_NIGHT_START_MINUTES = 22 * 60;
export const DEFAULT_NIGHT_END_MINUTES = 8 * 60;
// 8 h since 2026-10-15 (user-requested; was 9.5 h here, 10 h on the phone), the same on both.
export const MIN_NIGHT_WINDOW_MINUTES = MIN_NIGHT_WINDOW_HOURS * 60;

const ENABLED_KEY = 'desktop_night_block_enabled_v1';
const WINDOW_KEY = 'desktop_night_block_window_v1';

export interface NightWindow {
  startMinutes: number;
  endMinutes: number;
  /** Friday and Saturday nights (weekend-mode), 0 = from midnight. Absent: DEFAULT_WEEKEND_NIGHT_START. */
  weekendStartMinutes?: number;
}

export interface NightSettings {
  enabled: boolean;
  window: NightWindow;
}

export function formatNightWindowMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/** "22:30" -> 1350; null for anything that isn't a valid HH:MM. */
export function parseNightTimeInput(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function nightWindowDurationMinutes(startMinutes: number, endMinutes: number): number {
  return 24 * 60 - startMinutes + endMinutes;
}

// Same rules and wording as mobile's setNightWindowPersisted, returned rather than thrown since it's
// form validation.
export function validateNightWindow(next: NightWindow): { ok: true } | { ok: false; error: string } {
  if (next.startMinutes <= next.endMinutes) {
    return { ok: false, error: 'La hora de inicio debe ser de noche y la de fin a la mañana siguiente.' };
  }
  const duration = nightWindowDurationMinutes(next.startMinutes, next.endMinutes);
  if (duration < MIN_NIGHT_WINDOW_MINUTES) {
    const hours = Math.round((duration / 60) * 10) / 10;
    return { ok: false, error: `La ventana debe durar al menos ${MIN_NIGHT_WINDOW_MINUTES / 60} horas (dura ${hours}h con estos valores).` };
  }
  return next.weekendStartMinutes === undefined ? { ok: true } : validateNightStart(next.weekendStartMinutes);
}

// ---- Persisted settings + pub/sub ----
//
// Two readers must agree instantly: the always-mounted DesktopBlockingBridge (via
// useNightWindowActive) and the settings card on the block-list page. Module-level state with
// listeners, the same shape mobile's state.ts uses.

function readSettings(): NightSettings {
  let enabled = true;
  let window: NightWindow = {
    startMinutes: DEFAULT_NIGHT_START_MINUTES,
    endMinutes: DEFAULT_NIGHT_END_MINUTES,
    weekendStartMinutes: DEFAULT_WEEKEND_NIGHT_START,
  };
  try {
    const storedEnabled = localStorage.getItem(ENABLED_KEY);
    if (storedEnabled !== null) enabled = storedEnabled === 'true';
    const storedWindow = localStorage.getItem(WINDOW_KEY);
    if (storedWindow) {
      const parsed = JSON.parse(storedWindow) as Partial<NightWindow>;
      if (
        typeof parsed.startMinutes === 'number' &&
        typeof parsed.endMinutes === 'number' &&
        validateNightWindow({ startMinutes: parsed.startMinutes, endMinutes: parsed.endMinutes }).ok
      ) {
        window = {
          startMinutes: parsed.startMinutes,
          endMinutes: parsed.endMinutes,
          weekendStartMinutes: parsed.weekendStartMinutes ?? DEFAULT_WEEKEND_NIGHT_START,
        };
      }
    }
  } catch {
    // Storage blocked or a corrupt value: fall back to the defaults rather than crash.
  }
  return { enabled, window };
}

let settings: NightSettings | null = null;
const listeners = new Set<(settings: NightSettings) => void>();

export function getNightSettings(): NightSettings {
  if (!settings) settings = readSettings();
  return settings;
}

export function subscribeNightSettings(listener: (settings: NightSettings) => void): () => void {
  listeners.add(listener);
  listener(getNightSettings());
  return () => {
    listeners.delete(listener);
  };
}

function publish(next: NightSettings): void {
  settings = next;
  listeners.forEach((listener) => listener(next));
}

export function setNightEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false');
  } catch {
    // Applies for this session even if it can't be stored.
  }
  publish({ ...getNightSettings(), enabled });
}

export function setNightWindow(next: NightWindow): { ok: true } | { ok: false; error: string } {
  const result = validateNightWindow(next);
  if (!result.ok) return result;
  try {
    localStorage.setItem(WINDOW_KEY, JSON.stringify(next));
  } catch {
    // Applies for this session even if it can't be stored.
  }
  publish({ ...getNightSettings(), window: next });
  return result;
}

// ---- Pre-night warnings ----
//
// The half hour before a block starts warns every 15 minutes (21:30 and 21:45 with the default
// 22:00 start; League of Legends' own 20:00 warns at 19:30). Same numbers as Android's accessibility
// service (NIGHT_WARNING_LEAD_MIN / NIGHT_WARNING_EVERY_MS).
export const NIGHT_WARNING_EVERY_MINUTES = 15;

/** What's about to start when a warning is due now, otherwise null. Without targets, the general block. */
export function nightWarningDue(
  now: Date,
  settings: NightSettings,
  lastWarnedAtMs: number | null,
  targets: readonly NightWarningTarget[] = [{ label: null }],
) {
  if (!settings.enabled) return null;
  if (lastWarnedAtMs !== null && now.getTime() - lastWarnedAtMs < NIGHT_WARNING_EVERY_MINUTES * 60_000) return null;
  return upcomingNightStart(now, settings.window, targets);
}
