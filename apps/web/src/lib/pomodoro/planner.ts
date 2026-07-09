export type FocusSegmentType = 'pomodoro' | 'short-break' | 'long-break';

export interface FocusPlanSegment {
  type: FocusSegmentType;
  startMinute: number;
  endMinute: number;
}

export interface FocusPlanConfig {
  pomodoroMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  pomodorosPerChunk: number;
}

export const FOCUS_ESTIMATE_MIN_MIN = 25;
export const FOCUS_ESTIMATE_MIN_MAX = 35;
export const FOCUS_ESTIMATE_DEFAULT_MIN = 25;
export const DEFAULT_SHORT_BREAK_MIN = 5;
export const DEFAULT_LONG_BREAK_MIN = 20;
export const DEFAULT_POMODOROS_PER_CHUNK = 4;
export const MAX_LONG_BREAKS = 4;

export const DEFAULT_FOCUS_PLAN_CONFIG: FocusPlanConfig = {
  pomodoroMin: FOCUS_ESTIMATE_DEFAULT_MIN,
  shortBreakMin: DEFAULT_SHORT_BREAK_MIN,
  longBreakMin: DEFAULT_LONG_BREAK_MIN,
  pomodorosPerChunk: DEFAULT_POMODOROS_PER_CHUNK,
};

function boundEstimate(estimateMin: number): number {
  return Math.max(FOCUS_ESTIMATE_MIN_MIN, Math.min(FOCUS_ESTIMATE_MIN_MAX, Math.round(estimateMin)));
}

function sanitizeConfig(config: FocusPlanConfig): FocusPlanConfig {
  return {
    pomodoroMin: Math.max(1, Math.round(config.pomodoroMin)),
    shortBreakMin: Math.max(1, Math.round(config.shortBreakMin)),
    longBreakMin: Math.max(1, Math.round(config.longBreakMin)),
    pomodorosPerChunk: Math.max(1, Math.round(config.pomodorosPerChunk)),
  };
}

/** Finds the largest chunk count (capped at MAX_LONG_BREAKS + 1) that fits `totalMinutes` at this config. */
function planChunkCount(totalMinutes: number, config: FocusPlanConfig): number {
  const chunkLength =
    config.pomodorosPerChunk * config.pomodoroMin + (config.pomodorosPerChunk - 1) * config.shortBreakMin;
  const maxChunks = MAX_LONG_BREAKS + 1;

  for (let chunks = maxChunks; chunks >= 1; chunks -= 1) {
    const total = chunks * chunkLength + (chunks - 1) * config.longBreakMin;
    if (total <= totalMinutes) return chunks;
  }

  return 0;
}

function buildChunkedSegments(startMinute: number, chunks: number, config: FocusPlanConfig): FocusPlanSegment[] {
  const segments: FocusPlanSegment[] = [];
  let cursor = startMinute;

  for (let chunkIndex = 0; chunkIndex < chunks; chunkIndex += 1) {
    for (let pomodoroIndex = 0; pomodoroIndex < config.pomodorosPerChunk; pomodoroIndex += 1) {
      segments.push({ type: 'pomodoro', startMinute: cursor, endMinute: cursor + config.pomodoroMin });
      cursor += config.pomodoroMin;

      if (pomodoroIndex < config.pomodorosPerChunk - 1) {
        segments.push({ type: 'short-break', startMinute: cursor, endMinute: cursor + config.shortBreakMin });
        cursor += config.shortBreakMin;
      }
    }

    if (chunkIndex < chunks - 1) {
      segments.push({ type: 'long-break', startMinute: cursor, endMinute: cursor + config.longBreakMin });
      cursor += config.longBreakMin;
    }
  }

  return segments;
}

/** Fallback for ranges too short to fit a full chunk: pack as many pomodoros as fit, short breaks only. */
function buildGreedySegments(startMinute: number, totalMinutes: number, config: FocusPlanConfig): FocusPlanSegment[] {
  const segments: FocusPlanSegment[] = [];
  let cursor = startMinute;
  let remaining = totalMinutes;

  while (remaining >= config.pomodoroMin) {
    segments.push({ type: 'pomodoro', startMinute: cursor, endMinute: cursor + config.pomodoroMin });
    cursor += config.pomodoroMin;
    remaining -= config.pomodoroMin;

    if (remaining >= config.shortBreakMin + config.pomodoroMin) {
      segments.push({ type: 'short-break', startMinute: cursor, endMinute: cursor + config.shortBreakMin });
      cursor += config.shortBreakMin;
      remaining -= config.shortBreakMin;
    } else {
      break;
    }
  }

  return segments;
}

/**
 * Splits a general work range into pomodoro / short-break / long-break segments using an
 * explicit, user-editable config (pomodoro length, break lengths, pomodoros per chunk).
 * Chunks are capped at MAX_LONG_BREAKS long breaks per range (falls back to a single greedy
 * chunk when the range is too short to fit one full configured chunk).
 */
export function generateFocusPlan(
  startMinute: number,
  endMinute: number,
  config: FocusPlanConfig = DEFAULT_FOCUS_PLAN_CONFIG,
): FocusPlanSegment[] {
  const totalMinutes = endMinute - startMinute;
  const safeConfig = sanitizeConfig(config);
  if (totalMinutes < safeConfig.pomodoroMin) return [];

  const chunks = planChunkCount(totalMinutes, safeConfig);
  if (chunks > 0) {
    return buildChunkedSegments(startMinute, chunks, safeConfig);
  }

  return buildGreedySegments(startMinute, totalMinutes, safeConfig);
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
