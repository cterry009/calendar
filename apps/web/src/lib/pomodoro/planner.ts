import {
  boundEstimate,
  FOCUS_ESTIMATE_DEFAULT_MIN,
  resolveFocusPlanConfigWith,
  type FocusPlanConfig,
  type SchedulePlanFields,
} from '@calendar/shared';

// The plan math itself (segments, chunks, breaks, the excluded lunch window) lives in
// packages/shared/src/pomodoro/focusPlan.ts so mobile draws the same pomodoros. This module
// re-exports it for the existing web imports and keeps the one web-only piece: the adaptive
// pomodoro length, learned from self-reported concentration and stored in localStorage.
export {
  availableFocusMinutes,
  computeEndMinuteForConfig,
  computeMaxChunks,
  countSegmentsByType,
  DEFAULT_CHUNKS,
  DEFAULT_FOCUS_PLAN_CONFIG,
  DEFAULT_LONG_BREAK_MIN,
  DEFAULT_POMODOROS_PER_CHUNK,
  DEFAULT_SHORT_BREAK_MIN,
  estimateLongBreakMin,
  estimateShortBreakMin,
  EXCLUDED_WORK_WINDOWS,
  FOCUS_ESTIMATE_DEFAULT_MIN,
  FOCUS_ESTIMATE_MIN_MAX,
  FOCUS_ESTIMATE_MIN_MIN,
  generateFocusPlan,
  LONG_BREAK_MIN_MAX,
  LONG_BREAK_MIN_MIN,
  MAX_CHUNKS,
  MAX_LONG_BREAKS,
  MINUTES_PER_DAY,
  requiredMinutesForConfig,
  SHORT_BREAK_MIN_MAX,
  SHORT_BREAK_MIN_MIN,
} from '@calendar/shared';
export type { FocusPlanConfig, FocusPlanSegment, FocusSegmentType, SchedulePlanFields } from '@calendar/shared';

/**
 * Resolves a WORK schedule's stored (possibly null, for schedules saved before this feature)
 * plan fields into a concrete FocusPlanConfig -- the single source of truth used both to render
 * the calendar's Day view timeline and to decide when a pomodoro should auto-start.
 */
export function resolveFocusPlanConfig(schedule: SchedulePlanFields): FocusPlanConfig {
  return resolveFocusPlanConfigWith(schedule, estimateFocusDurationMin(loadFocusFeedbackHistory()));
}

// ─── Adaptive pomodoro-length estimate from self-reported concentration ──────

const FEEDBACK_STORAGE_KEY = 'calendar:focus-feedback-history';
const FEEDBACK_HISTORY_LIMIT = 20;
const FEEDBACK_SAMPLE_WINDOW = 8;

export function loadFocusFeedbackHistory(): number[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  } catch {
    return [];
  }
}

export function recordFocusFeedbackSample(minutes: number): number[] {
  const history = loadFocusFeedbackHistory();
  const next = [...history, Math.max(1, Math.round(minutes))].slice(-FEEDBACK_HISTORY_LIMIT);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(next));
  }

  return next;
}

export function estimateFocusDurationMin(history: number[] = loadFocusFeedbackHistory()): number {
  if (history.length === 0) return FOCUS_ESTIMATE_DEFAULT_MIN;

  const recent = history.slice(-FEEDBACK_SAMPLE_WINDOW);
  const average = recent.reduce((sum, value) => sum + value, 0) / recent.length;
  return boundEstimate(average);
}
