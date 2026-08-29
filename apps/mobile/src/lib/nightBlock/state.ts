import { platformStorage } from '../platformStorage';

const NIGHT_BLOCK_ENABLED_KEY = 'calendar_night_block_enabled_v1';

// Module-level singleton, same pattern as lib/sync/api.ts's subscribeSyncStatus -- this flag has
// two independent readers that must always agree instantly: the always-mounted native-push bridge
// (useNightBlocking.ts) and blocklist.tsx's own on/off switch. Off by default: night blocking
// (and the more aggressive jog-to-unlock enforcement it enables, task 11.11) shouldn't turn itself
// on just because the user added an app to the list -- it's an explicit opt-in.
let enabled = false;
let loaded = false;
const listeners = new Set<(enabled: boolean) => void>();

function notify() {
  listeners.forEach((listener) => listener(enabled));
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  loaded = true;
  const stored = await platformStorage.getItem(NIGHT_BLOCK_ENABLED_KEY);
  enabled = stored === 'true';
  notify();
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
