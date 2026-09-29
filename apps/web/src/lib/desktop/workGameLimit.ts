import { WORK_HOURS_CLOSE_GRACE_MINUTES, type UsageWarningCategory } from '@calendar/shared';

// Per-day, per-category (GAMES / SOCIAL) state of the strict work-hours limit (packages/shared
// usageWarnings.ts): whether the final warning has been given and, once the closing warning
// fires, when the grace period ends. Written by DesktopUsageWarnings, read by useWorkGameLock, which adds the category's apps
// used today to the kill list once the deadline passes and while a WORK block is active.
//
// Stored in localStorage under a local-date key so it survives an app restart mid-countdown (the
// deadline is absolute, so reopening the app can't buy more time) and resets on its own overnight.

export interface WorkGameLimitState {
  finalWarningGiven: boolean;
  /** Epoch ms when the game gets closed; null until the closing warning fires. */
  closeDeadline: number | null;
}

const EMPTY: WorkGameLimitState = { finalWarningGiven: false, closeDeadline: null };

function dayKey(category: UsageWarningCategory, now = new Date()): string {
  // GAMES keeps its original key so a countdown already running survives this update.
  const prefix = category === 'GAMES' ? 'work-game-limit' : 'work-social-limit';
  return `${prefix}:${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

export function getWorkGameLimit(category: UsageWarningCategory, now = new Date()): WorkGameLimitState {
  try {
    const raw = localStorage.getItem(dayKey(category, now));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<WorkGameLimitState>;
    return {
      finalWarningGiven: parsed.finalWarningGiven === true,
      closeDeadline: typeof parsed.closeDeadline === 'number' ? parsed.closeDeadline : null,
    };
  } catch {
    return EMPTY;
  }
}

const listeners = new Set<() => void>();

export function subscribeWorkGameLimit(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function write(category: UsageWarningCategory, next: WorkGameLimitState): void {
  try {
    localStorage.setItem(dayKey(category), JSON.stringify(next));
  } catch {
    // Storage blocked: the in-flight session still sees the change through the listeners below,
    // it just won't survive a restart.
  }
  listeners.forEach((listener) => listener());
}

export function markFinalWarningGiven(category: UsageWarningCategory): void {
  write(category, { ...getWorkGameLimit(category), finalWarningGiven: true });
}

/** Starts the grace period, or returns the existing deadline if one is already running. */
export function startCloseCountdown(category: UsageWarningCategory, nowMs = Date.now()): number {
  const current = getWorkGameLimit(category);
  if (current.closeDeadline !== null) return current.closeDeadline;
  const deadline = nowMs + WORK_HOURS_CLOSE_GRACE_MINUTES * 60_000;
  write(category, { ...current, closeDeadline: deadline });
  return deadline;
}

export function isGameLockReached(state: WorkGameLimitState, nowMs: number): boolean {
  return state.closeDeadline !== null && nowMs >= state.closeDeadline;
}
