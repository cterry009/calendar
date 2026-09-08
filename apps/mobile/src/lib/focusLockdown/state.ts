import { platformStorage } from '../platformStorage';

const FOCUS_LOCKDOWN_ENABLED_KEY = 'calendar_focus_lockdown_enabled_v1';

// Task 7.28 ("bloqueo total"). Module-level singleton, same pattern and reasoning as
// lib/nightBlock/state.ts: two readers that must always agree instantly -- the always-mounted
// native-push bridge (useFocusBlocking.ts) and blocklist.tsx's own on/off switch.
//
// Default ON, unlike night blocking's default OFF: the user explicitly asked for focus to enforce
// a total block "like on the web" (where apps/web's WORK-schedule overlay is mandatory). The
// safety allowlist (calls, Settings, launcher, keyboard -- resolved natively) means "on" is never
// a true phone-brick, so defaulting it on is safe; the switch exists for anyone who wants the
// softer block-list-only behavior back.
let enabled = true;
let loaded = false;
const listeners = new Set<(enabled: boolean) => void>();

function notify() {
  listeners.forEach((listener) => listener(enabled));
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  loaded = true;
  const stored = await platformStorage.getItem(FOCUS_LOCKDOWN_ENABLED_KEY);
  // Only an explicit stored 'false' turns it off -- a missing key (fresh install / upgrade) keeps
  // the default-on behavior.
  if (stored === 'false') {
    enabled = false;
    notify();
  }
}

export function subscribeFocusLockdownEnabled(listener: (enabled: boolean) => void): () => void {
  listeners.add(listener);
  listener(enabled);
  void ensureLoaded();
  return () => listeners.delete(listener);
}

export function getFocusLockdownEnabledSnapshot(): boolean {
  return enabled;
}

export async function setFocusLockdownEnabledPersisted(next: boolean): Promise<void> {
  enabled = next;
  notify();
  await platformStorage.setItem(FOCUS_LOCKDOWN_ENABLED_KEY, next ? 'true' : 'false');
}
