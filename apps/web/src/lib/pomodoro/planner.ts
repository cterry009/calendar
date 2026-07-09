export type FocusSegmentType = 'pomodoro' | 'short-break' | 'long-break';

export interface FocusPlanSegment {
  type: FocusSegmentType;
  startMinute: number;
  endMinute: number;
}

export const FOCUS_ESTIMATE_MIN_MIN = 25;
export const FOCUS_ESTIMATE_MIN_MAX = 35;
export const FOCUS_ESTIMATE_DEFAULT_MIN = 25;
export const SHORT_BREAK_MIN = 5;
export const LONG_BREAK_MIN = 20;
export const LONG_BREAK_MIN_MAX = 30;
export const MAX_LONG_BREAKS = 4;
export const MIN_POMODOROS_PER_CHUNK = 4;
export const MAX_POMODOROS_PER_CHUNK = 5;

interface ChunkPlan {
  chunks: number;
  pomodorosPerChunk: number;
  totalMinutes: number;
}

function boundEstimate(estimateMin: number): number {
  return Math.max(FOCUS_ESTIMATE_MIN_MIN, Math.min(FOCUS_ESTIMATE_MIN_MAX, Math.round(estimateMin)));
}

/** Finds the (chunks x pomodorosPerChunk) combo that fits `totalMinutes`, maximizing total pomodoros. */
function planChunks(totalMinutes: number, estimateMin: number): ChunkPlan | null {
  let best: ChunkPlan | null = null;
  const maxChunks = MAX_LONG_BREAKS + 1;

  for (let chunks = maxChunks; chunks >= 1; chunks -= 1) {
    for (const pomodorosPerChunk of [MAX_POMODOROS_PER_CHUNK, MIN_POMODOROS_PER_CHUNK]) {
      const chunkLength = pomodorosPerChunk * estimateMin + (pomodorosPerChunk - 1) * SHORT_BREAK_MIN;
      const total = chunks * chunkLength + (chunks - 1) * LONG_BREAK_MIN;
      if (total > totalMinutes) continue;

      const candidatePomodoros = chunks * pomodorosPerChunk;
      const bestPomodoros = best ? best.chunks * best.pomodorosPerChunk : -1;

      if (!best || candidatePomodoros > bestPomodoros || (candidatePomodoros === bestPomodoros && total > best.totalMinutes)) {
        best = { chunks, pomodorosPerChunk, totalMinutes: total };
      }
    }
  }

  return best;
}

function buildChunkedSegments(startMinute: number, plan: ChunkPlan, estimateMin: number, totalMinutes: number): FocusPlanSegment[] {
  let leftover = totalMinutes - plan.totalMinutes;
  let longBreakMin = LONG_BREAK_MIN;
  let estimate = estimateMin;

  const longBreakCount = plan.chunks - 1;
  if (leftover > 0 && longBreakCount > 0) {
    const maxBoostPerBreak = LONG_BREAK_MIN_MAX - LONG_BREAK_MIN;
    const boostPerBreak = Math.min(Math.floor(leftover / longBreakCount), maxBoostPerBreak);
    if (boostPerBreak > 0) {
      longBreakMin += boostPerBreak;
      leftover -= boostPerBreak * longBreakCount;
    }
  }

  const totalPomodoros = plan.chunks * plan.pomodorosPerChunk;
  if (leftover > 0 && estimate < FOCUS_ESTIMATE_MIN_MAX) {
    const maxBoost = FOCUS_ESTIMATE_MIN_MAX - estimate;
    const boostPerPomodoro = Math.min(Math.floor(leftover / totalPomodoros), maxBoost);
    if (boostPerPomodoro > 0) {
      estimate += boostPerPomodoro;
    }
  }

  const segments: FocusPlanSegment[] = [];
  let cursor = startMinute;

  for (let chunkIndex = 0; chunkIndex < plan.chunks; chunkIndex += 1) {
    for (let pomodoroIndex = 0; pomodoroIndex < plan.pomodorosPerChunk; pomodoroIndex += 1) {
      segments.push({ type: 'pomodoro', startMinute: cursor, endMinute: cursor + estimate });
      cursor += estimate;

      if (pomodoroIndex < plan.pomodorosPerChunk - 1) {
        segments.push({ type: 'short-break', startMinute: cursor, endMinute: cursor + SHORT_BREAK_MIN });
        cursor += SHORT_BREAK_MIN;
      }
    }

    if (chunkIndex < plan.chunks - 1) {
      segments.push({ type: 'long-break', startMinute: cursor, endMinute: cursor + longBreakMin });
      cursor += longBreakMin;
    }
  }

  return segments;
}

/** Fallback for ranges too short to fit a full 4-pomodoro chunk: pack as many pomodoros as fit, short breaks only. */
function buildGreedySegments(startMinute: number, totalMinutes: number, estimateMin: number): FocusPlanSegment[] {
  const segments: FocusPlanSegment[] = [];
  let cursor = startMinute;
  let remaining = totalMinutes;

  while (remaining >= estimateMin) {
    segments.push({ type: 'pomodoro', startMinute: cursor, endMinute: cursor + estimateMin });
    cursor += estimateMin;
    remaining -= estimateMin;

    if (remaining >= SHORT_BREAK_MIN + estimateMin) {
      segments.push({ type: 'short-break', startMinute: cursor, endMinute: cursor + SHORT_BREAK_MIN });
      cursor += SHORT_BREAK_MIN;
      remaining -= SHORT_BREAK_MIN;
    } else {
      break;
    }
  }

  return segments;
}

/**
 * Splits a general work range into pomodoro / short-break / long-break segments.
 * Prefers chunks of 4-5 pomodoros separated by long breaks, capped at 4 long breaks per range
 * (falls back to a single greedy chunk when the range is too short for that).
 */
export function generateFocusPlan(
  startMinute: number,
  endMinute: number,
  estimateMin: number = FOCUS_ESTIMATE_DEFAULT_MIN,
): FocusPlanSegment[] {
  const totalMinutes = endMinute - startMinute;
  if (totalMinutes < FOCUS_ESTIMATE_MIN_MIN) return [];

  const estimate = boundEstimate(estimateMin);
  const plan = planChunks(totalMinutes, estimate);
  if (plan) {
    return buildChunkedSegments(startMinute, plan, estimate, totalMinutes);
  }

  return buildGreedySegments(startMinute, totalMinutes, estimate);
}

export function countSegmentsByType(plan: FocusPlanSegment[], type: FocusSegmentType): number {
  return plan.filter((segment) => segment.type === type).length;
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
