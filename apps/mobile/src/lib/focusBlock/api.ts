import { Platform } from 'react-native';
import FocusBlockModule from '../../../modules/focus-block/src';
import type { NativePendingBlockEvent } from '../../../modules/focus-block/src/FocusBlock.types';

// Every export here no-ops (or throws, for the two that don't have a sensible silent fallback) on
// anything but Android -- there is no OS-level "what app is in the foreground" concept on web/iOS
// for this local module to hook into. Callers (useFocusBlocking.ts) still run the trigger
// computation on every platform since it's cheap and platform-agnostic; only the native push is
// gated here, one guard point instead of scattering Platform.OS checks through the hook.

// `lockdown` (task 7.28): with it on, an active focus/work session blocks every non-allowlisted
// app, not only the ones in `blockedPackages` -- the mobile equivalent of apps/web's mandatory
// full-screen focus overlay. The allowlist (own app, launcher, system UI, phone/dialer, Settings,
// keyboard) is resolved natively; see FocusBlockAccessibilityService.isFocusAllowlisted.
//
// `activeUntil`: when `active` lapses natively if the app process dies before saying otherwise -- the
// end of the focus phase or WORK block that made it active (null = no known end).
export function setBlockingState(active: boolean, activeUntil: Date | null, blockedPackages: string[], lockdown: boolean): void {
  if (Platform.OS !== 'android') return;
  FocusBlockModule.setBlockingState(active, active && activeUntil ? activeUntil.getTime() : 0, blockedPackages, lockdown);
}

// Task 11.9: the NIGHT-scope list's push, kept fully separate from setBlockingState above --
// see FocusBlockPrefs.kt's doc comment for why.
export function setNightBlockingState(enabled: boolean, blockedPackages: string[]): void {
  if (Platform.OS !== 'android') return;
  FocusBlockModule.setNightBlockingState(enabled, blockedPackages);
}

// Task 11.22: the night window (previously a fixed 22:30-08:00 constant). Minutes are since
// midnight (e.g. 22:30 -> 1350). The >=10h-duration check lives in lib/nightBlock/state.ts, not
// here -- this is just the native push, same "no business logic on this side" shape as
// setNightBlockingState above.
export function setNightWindow(startMinutes: number, endMinutes: number): void {
  if (Platform.OS !== 'android') return;
  FocusBlockModule.setNightWindow(startMinutes, endMinutes);
}

export function getNightWindowStartMinutes(): number {
  if (Platform.OS !== 'android') return 22 * 60 + 30;
  return FocusBlockModule.getNightWindowStartMinutes();
}

export function getNightWindowEndMinutes(): number {
  if (Platform.OS !== 'android') return 8 * 60;
  return FocusBlockModule.getNightWindowEndMinutes();
}

export function isAccessibilityServiceEnabled(): boolean {
  if (Platform.OS !== 'android') return false;
  return FocusBlockModule.isAccessibilityServiceEnabled();
}

export function openAccessibilitySettings(): void {
  if (Platform.OS !== 'android') {
    throw new Error('El bloqueo real de apps solo esta disponible en Android.');
  }
  FocusBlockModule.openAccessibilitySettings();
}

// Task 6.7 fix's other real dependency (Android 14+ only -- see design.md decision 36/37): without
// this, the AccessibilityService's fullScreenIntent notification silently never shows, the same
// "blocked app disappears but no explanation ever appears" symptom the fix itself was for.
export function isFullScreenIntentAllowed(): boolean {
  if (Platform.OS !== 'android') return false;
  return FocusBlockModule.isFullScreenIntentAllowed();
}

export function openFullScreenIntentSettings(): void {
  if (Platform.OS !== 'android') {
    throw new Error('El bloqueo real de apps solo esta disponible en Android.');
  }
  FocusBlockModule.openFullScreenIntentSettings();
}

// Task 11.12: the AccessibilityService (and the night-window/jog-unlock rule it now evaluates,
// tasks 11.10/11.11) isn't immune to Doze/OEM battery killers -- this is the one mitigation
// actually available. Same "can't enable programmatically" pattern as the two functions above.
export function isIgnoringBatteryOptimizations(): boolean {
  if (Platform.OS !== 'android') return false;
  return FocusBlockModule.isIgnoringBatteryOptimizations();
}

export function openBatteryOptimizationSettings(): void {
  if (Platform.OS !== 'android') {
    throw new Error('El bloqueo real de apps solo esta disponible en Android.');
  }
  FocusBlockModule.openBatteryOptimizationSettings();
}

// Task 8.2: hands back whatever BlockEvent rows the AccessibilityService logged natively since
// the last drain, clearing them from native storage in the same call -- see
// FocusBlockPrefs.drainPendingBlockEvents's doc comment for why that's atomic. Empty array (not
// an error) off-Android, since there's genuinely nothing to drain there.
export function drainPendingBlockEvents(): NativePendingBlockEvent[] {
  if (Platform.OS !== 'android') return [];
  return FocusBlockModule.drainPendingBlockEvents();
}

// Work-hours social limit, evaluated natively (WorkSocialLimit.kt) so it works while this app is
// closed. `windows` are the enabled WORK schedules.
export function setWorkSocialLimit(
  windows: Array<{ days: number[]; start: number; end: number; label?: string; id?: string; skip?: string[] }>,
  socialPackages: string[],
): void {
  if (Platform.OS !== 'android') return;
  // try: an installed binary older than this JS (dev builds get new JS over Metro) lacks it.
  try {
    FocusBlockModule.setWorkSocialLimit(JSON.stringify(windows), socialPackages);
  } catch {
    // Needs a native rebuild; the limit just isn't enforced until then.
  }
}

/** Native view of "inside a WORK block right now" -- false off Android. */
export function isNativeWorkHours(): boolean {
  if (Platform.OS !== 'android') return false;
  try {
    return FocusBlockModule.isWorkHours();
  } catch {
    return false;
  }
}

// Texts for the native block popup (BlockPopup.kt), from the shared lists the desktop popup uses.
export function setBlockPopupContent(content: {
  suggestions: Record<string, string[]>;
  phrases: string[];
}): void {
  if (Platform.OS !== 'android') return;
  try {
    FocusBlockModule.setBlockPopupContent(JSON.stringify(content));
  } catch {
    // Older native build without it: the popup falls back to its built-in texts.
  }
}

// The persistent "you're working" notification (useFocusStatusNotification.ts): block, phase and a
// native countdown to `endsAt`. Called only when what it shows changes; Android redraws the clock.
export function setFocusStatus(title: string, text: string, endsAt: Date): void {
  if (Platform.OS !== 'android') return;
  FocusBlockModule.setFocusStatus(title, text, endsAt.getTime());
}

export function clearFocusStatus(): void {
  if (Platform.OS !== 'android') return;
  FocusBlockModule.clearFocusStatus();
}

// WEBSITE block-list entries, per list: the accessibility service kicks these domains (and their
// subdomains) in the phone's browsers, under the same conditions as that list's apps.
export function setBlockedDomains(focus: string[], night: string[]): void {
  if (Platform.OS !== 'android') return;
  try {
    FocusBlockModule.setBlockedDomains(focus, night);
  } catch {
    // Older native build without it: sites just aren't blocked on the phone until a rebuild.
  }
}

export interface WebsiteUsageRecord {
  domain: string;
  totalTimeMs: number;
}

/** Time per website measured from the browsers' address bar, most used first; [] off Android. */
export function getWebsiteUsage(startMillis: number, endMillis: number): WebsiteUsageRecord[] {
  if (Platform.OS !== 'android') return [];
  try {
    return FocusBlockModule.getWebsiteUsage(startMillis, endMillis);
  } catch {
    return [];
  }
}

// The pomodoro over the screen during a WORK block (FocusOverlay.kt). `state` is what it shows;
// exits made on it are drained and applied by useBlockFocus; clearing an exit lets it pop up again.
export interface FocusOverlayState {
  scheduleId?: string;
  title?: string;
  text?: string;
  endsAtMs?: number;
  running?: boolean;
  paused?: boolean;
  exits?: number;
  /** FOCUS / SHORT_BREAK / LONG_BREAK: "para terminar este pomodoro" only in a focus phase. */
  phase?: string;
  /** What's left of the pomodoro; frozen while out of the block. */
  remainingMs?: number;
  /** A line to finish it (finishPomodoroPhrase). */
  phrase?: string;
  /** The study session it's on (studySessionLine). */
  session?: string;
  /** Its task, for the per-pomodoro review. */
  taskId?: string;
  sessionId?: string;
  /** Focus pomodoros completed: when it goes up, one just finished (the phone's card asks). */
  cycles?: number;
  blockLabel?: string;
  /** The next finished pomodoro is the session's last: ask whether it got done. */
  askSession?: boolean;
}

export function setFocusOverlayState(state: FocusOverlayState): void {
  if (Platform.OS !== 'android') return;
  try {
    FocusBlockModule.setFocusOverlayState(JSON.stringify(state));
  } catch {
    // Older native build: no overlay until a rebuild.
  }
}

export function drainOverlayExits(): { key: string; at: string }[] {
  if (Platform.OS !== 'android') return [];
  try {
    return FocusBlockModule.drainOverlayExits();
  } catch {
    return [];
  }
}

export function clearOverlayExit(key: string): void {
  if (Platform.OS !== 'android') return;
  try {
    FocusBlockModule.clearOverlayExit(key);
  } catch {
    // Older native build.
  }
}

/** This block occurrence was reviewed in the app: the phone's end-of-block card doesn't ask again. */
export function markBlockReviewed(key: string): void {
  if (Platform.OS !== 'android') return;
  try {
    FocusBlockModule.markBlockReviewed(key);
  } catch {
    // Older native build.
  }
}
