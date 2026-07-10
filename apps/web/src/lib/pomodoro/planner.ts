export type FocusSegmentType = 'pomodoro' | 'short-break' | 'long-break' | 'excluded';

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
  chunks: number;
}

export const FOCUS_ESTIMATE_MIN_MIN = 30;
export const FOCUS_ESTIMATE_MIN_MAX = 45;
export const FOCUS_ESTIMATE_DEFAULT_MIN = 30;
export const SHORT_BREAK_MIN_MIN = 5;
export const SHORT_BREAK_MIN_MAX = 10;
export const LONG_BREAK_MIN_MIN = 20;
export const LONG_BREAK_MIN_MAX = 30;
export const DEFAULT_SHORT_BREAK_MIN = SHORT_BREAK_MIN_MIN;
export const DEFAULT_LONG_BREAK_MIN = LONG_BREAK_MIN_MIN;
export const DEFAULT_POMODOROS_PER_CHUNK = 4;
export const MAX_LONG_BREAKS = 4;
export const MAX_CHUNKS = MAX_LONG_BREAKS + 1;
export const DEFAULT_CHUNKS = 3;
export const MINUTES_PER_DAY = 24 * 60;

// Reference range of "total focus time in a block" used to scale the long-break suggestion --
// a short block (few/short pomodoros) only needs the minimum long break, a long one the maximum.
const TYPICAL_MIN_POMODOROS_PER_CHUNK = 3;
const TYPICAL_MAX_POMODOROS_PER_CHUNK = 6;

/** Fixed daily window during which no work/pomodoro block may be scheduled (e.g. lunch). */
export const EXCLUDED_WORK_WINDOWS: Array<{ startMinute: number; endMinute: number }> = [
  { startMinute: 12 * 60 + 30, endMinute: 13 * 60 + 30 },
];

function windowOverlapMinutes(
  startMinute: number,
  endMinute: number,
  windows: Array<{ startMinute: number; endMinute: number }>,
): number {
  return windows.reduce(
    (sum, window) => sum + Math.max(0, Math.min(endMinute, window.endMinute) - Math.max(startMinute, window.startMinute)),
    0,
  );
}

/** Minutes actually usable for pomodoro planning within [startMinute, endMinute), after discounting excluded windows. */
export function availableFocusMinutes(startMinute: number, endMinute: number): number {
  return Math.max(0, endMinute - startMinute - windowOverlapMinutes(startMinute, endMinute, EXCLUDED_WORK_WINDOWS));
}

function clippedExcludedWindows(
  startMinute: number,
  endMinute: number,
): Array<{ startMinute: number; endMinute: number }> {
  return EXCLUDED_WORK_WINDOWS.map((window) => ({
    startMinute: Math.max(window.startMinute, startMinute),
    endMinute: Math.min(window.endMinute, endMinute),
  })).filter((window) => window.endMinute > window.startMinute);
}

/** Pushes `cursor` forward past any excluded window it currently sits inside. */
function skipExcludedWindows(minute: number): number {
  let current = minute;
  let moved = true;
  while (moved) {
    moved = false;
    for (const window of EXCLUDED_WORK_WINDOWS) {
      if (current >= window.startMinute && current < window.endMinute) {
        current = window.endMinute;
        moved = true;
      }
    }
  }
  return current;
}

/** Finds the next valid start for a segment of `duration` minutes so it never overlaps an excluded window. */
function nextAvailableStart(cursor: number, duration: number): number {
  let start = skipExcludedWindows(cursor);
  let moved = true;
  while (moved) {
    moved = false;
    for (const window of EXCLUDED_WORK_WINDOWS) {
      if (start < window.endMinute && start + duration > window.startMinute) {
        start = window.endMinute;
        moved = true;
      }
    }
  }
  return start;
}

export const DEFAULT_FOCUS_PLAN_CONFIG: FocusPlanConfig = {
  pomodoroMin: FOCUS_ESTIMATE_DEFAULT_MIN,
  shortBreakMin: DEFAULT_SHORT_BREAK_MIN,
  longBreakMin: DEFAULT_LONG_BREAK_MIN,
  pomodorosPerChunk: DEFAULT_POMODOROS_PER_CHUNK,
  chunks: 1,
};

function boundEstimate(estimateMin: number): number {
  return Math.max(FOCUS_ESTIMATE_MIN_MIN, Math.min(FOCUS_ESTIMATE_MIN_MAX, Math.round(estimateMin)));
}

/** Maps `value` from [fromMin, fromMax] to [toMin, toMax], clamped at both ends. */
function scaleClamped(value: number, fromMin: number, fromMax: number, toMin: number, toMax: number): number {
  if (fromMax <= fromMin) return toMin;
  const ratio = Math.max(0, Math.min(1, (value - fromMin) / (fromMax - fromMin)));
  return Math.round(toMin + ratio * (toMax - toMin));
}

/** Suggests a short-break length (5-10min) that scales with pomodoro length (30-45min). */
export function estimateShortBreakMin(pomodoroMin: number): number {
  return scaleClamped(pomodoroMin, FOCUS_ESTIMATE_MIN_MIN, FOCUS_ESTIMATE_MIN_MAX, SHORT_BREAK_MIN_MIN, SHORT_BREAK_MIN_MAX);
}

/** Suggests a long-break length (20-30min) that scales with total focus time in a block. */
export function estimateLongBreakMin(pomodoroMin: number, pomodorosPerChunk: number): number {
  const totalFocusMin = pomodoroMin * pomodorosPerChunk;
  const typicalMinFocus = FOCUS_ESTIMATE_MIN_MIN * TYPICAL_MIN_POMODOROS_PER_CHUNK;
  const typicalMaxFocus = FOCUS_ESTIMATE_MIN_MAX * TYPICAL_MAX_POMODOROS_PER_CHUNK;
  return scaleClamped(totalFocusMin, typicalMinFocus, typicalMaxFocus, LONG_BREAK_MIN_MIN, LONG_BREAK_MIN_MAX);
}

function sanitizeConfig(config: FocusPlanConfig): FocusPlanConfig {
  return {
    pomodoroMin: Math.max(1, Math.round(config.pomodoroMin)),
    shortBreakMin: Math.max(1, Math.round(config.shortBreakMin)),
    longBreakMin: Math.max(1, Math.round(config.longBreakMin)),
    pomodorosPerChunk: Math.max(1, Math.round(config.pomodorosPerChunk)),
    chunks: Math.max(1, Math.min(MAX_CHUNKS, Math.round(config.chunks))),
  };
}

function chunkLengthFor(config: Pick<FocusPlanConfig, 'pomodoroMin' | 'shortBreakMin' | 'pomodorosPerChunk'>): number {
  return config.pomodorosPerChunk * config.pomodoroMin + (config.pomodorosPerChunk - 1) * config.shortBreakMin;
}

/** Total minutes a config's `chunks` would need, ignoring excluded windows. */
export function requiredMinutesForConfig(config: FocusPlanConfig): number {
  const safeConfig = sanitizeConfig(config);
  return safeConfig.chunks * chunkLengthFor(safeConfig) + (safeConfig.chunks - 1) * safeConfig.longBreakMin;
}

/** Largest chunk count (capped at MAX_CHUNKS) that fits within `availableMinutes` at this config. */
export function computeMaxChunks(
  availableMinutes: number,
  config: Pick<FocusPlanConfig, 'pomodoroMin' | 'shortBreakMin' | 'longBreakMin' | 'pomodorosPerChunk'>,
): number {
  const chunkLength = chunkLengthFor(config);

  for (let chunks = MAX_CHUNKS; chunks >= 1; chunks -= 1) {
    const total = chunks * chunkLength + (chunks - 1) * config.longBreakMin;
    if (total <= availableMinutes) return chunks;
  }

  return 0;
}

function buildChunkedSegments(startMinute: number, chunks: number, config: FocusPlanConfig): FocusPlanSegment[] {
  const segments: FocusPlanSegment[] = [];
  let cursor = startMinute;

  for (let chunkIndex = 0; chunkIndex < chunks; chunkIndex += 1) {
    for (let pomodoroIndex = 0; pomodoroIndex < config.pomodorosPerChunk; pomodoroIndex += 1) {
      cursor = nextAvailableStart(cursor, config.pomodoroMin);
      segments.push({ type: 'pomodoro', startMinute: cursor, endMinute: cursor + config.pomodoroMin });
      cursor += config.pomodoroMin;

      if (pomodoroIndex < config.pomodorosPerChunk - 1) {
        cursor = nextAvailableStart(cursor, config.shortBreakMin);
        segments.push({ type: 'short-break', startMinute: cursor, endMinute: cursor + config.shortBreakMin });
        cursor += config.shortBreakMin;
      }
    }

    if (chunkIndex < chunks - 1) {
      cursor = nextAvailableStart(cursor, config.longBreakMin);
      segments.push({ type: 'long-break', startMinute: cursor, endMinute: cursor + config.longBreakMin });
      cursor += config.longBreakMin;
    }
  }

  return segments;
}

/**
 * Derives the end-of-schedule minute needed to fit `config.chunks` blocks starting at
 * `startMinute` -- the schedule's total duration is a function of the block config, not the
 * other way around. Automatically stretches across the fixed excluded window (e.g. lunch) if
 * the blocks land on it, same as the segment placement itself.
 */
export function computeEndMinuteForConfig(startMinute: number, config: FocusPlanConfig): number {
  const safeConfig = sanitizeConfig(config);
  const segments = buildChunkedSegments(startMinute, safeConfig.chunks, safeConfig);
  if (segments.length === 0) return startMinute;
  return segments[segments.length - 1].endMinute;
}

/** Fallback for ranges too short to fit a full chunk: pack as many pomodoros as fit, short breaks only. */
function buildGreedySegments(startMinute: number, endMinute: number, config: FocusPlanConfig): FocusPlanSegment[] {
  const segments: FocusPlanSegment[] = [];
  let cursor = startMinute;

  while (true) {
    const pomodoroStart = nextAvailableStart(cursor, config.pomodoroMin);
    if (pomodoroStart + config.pomodoroMin > endMinute) break;

    segments.push({ type: 'pomodoro', startMinute: pomodoroStart, endMinute: pomodoroStart + config.pomodoroMin });
    cursor = pomodoroStart + config.pomodoroMin;

    const breakStart = nextAvailableStart(cursor, config.shortBreakMin);
    if (breakStart + config.shortBreakMin + config.pomodoroMin > endMinute) break;

    segments.push({ type: 'short-break', startMinute: breakStart, endMinute: breakStart + config.shortBreakMin });
    cursor = breakStart + config.shortBreakMin;
  }

  return segments;
}

/**
 * Splits a general work range into pomodoro / short-break / long-break segments using an
 * explicit, user-editable config (pomodoro length, break lengths, pomodoros per chunk, and
 * number of chunks). The requested chunk count is clamped to what actually fits within the
 * range (accounting for MAX_CHUNKS and any excluded window, e.g. the fixed lunch break) --
 * validate with `requiredMinutesForConfig`/`availableFocusMinutes` before saving so the UI can
 * reject configs that don't fit instead of silently truncating them.
 */
export function generateFocusPlan(
  startMinute: number,
  endMinute: number,
  config: FocusPlanConfig = DEFAULT_FOCUS_PLAN_CONFIG,
): FocusPlanSegment[] {
  const safeConfig = sanitizeConfig(config);
  const totalMinutes = endMinute - startMinute;
  if (totalMinutes < safeConfig.pomodoroMin) {
    return clippedExcludedWindows(startMinute, endMinute).map((window) => ({ type: 'excluded', ...window }));
  }

  const available = availableFocusMinutes(startMinute, endMinute);
  const maxFittingChunks = computeMaxChunks(available, safeConfig);
  const chunks = Math.min(safeConfig.chunks, maxFittingChunks);

  const rawSegments =
    chunks > 0
      ? buildChunkedSegments(startMinute, chunks, safeConfig)
      : buildGreedySegments(startMinute, endMinute, safeConfig);

  // Safety net: gap-skipping can fragment time unevenly around an excluded window in edge
  // cases where the capacity estimate was optimistic -- never render past the block's end.
  const segments = rawSegments.filter((segment) => segment.endMinute <= endMinute);

  const excluded = clippedExcludedWindows(startMinute, endMinute).map(
    (window): FocusPlanSegment => ({ type: 'excluded', ...window }),
  );

  return [...segments, ...excluded].sort((a, b) => a.startMinute - b.startMinute);
}

export function countSegmentsByType(plan: FocusPlanSegment[], type: FocusSegmentType): number {
  return plan.filter((segment) => segment.type === type).length;
}

export interface SchedulePlanFields {
  startMinute: number;
  endMinute: number;
  pomodoroMin: number | null;
  shortBreakMin: number | null;
  longBreakMin: number | null;
  pomodorosPerChunk: number | null;
  chunks: number | null;
}

/**
 * Resolves a WORK schedule's stored (possibly null, for schedules saved before this feature)
 * plan fields into a concrete FocusPlanConfig -- the single source of truth used both to render
 * the calendar's Day view timeline and to decide when a pomodoro should auto-start.
 */
export function resolveFocusPlanConfig(schedule: SchedulePlanFields): FocusPlanConfig {
  const pomodoroMin = schedule.pomodoroMin ?? estimateFocusDurationMin(loadFocusFeedbackHistory());
  const pomodorosPerChunk = schedule.pomodorosPerChunk ?? DEFAULT_POMODOROS_PER_CHUNK;
  const shortBreakMin = schedule.shortBreakMin ?? estimateShortBreakMin(pomodoroMin);
  const longBreakMin = schedule.longBreakMin ?? estimateLongBreakMin(pomodoroMin, pomodorosPerChunk);
  const chunks =
    schedule.chunks ??
    Math.max(
      1,
      computeMaxChunks(availableFocusMinutes(schedule.startMinute, schedule.endMinute), {
        pomodoroMin,
        shortBreakMin,
        longBreakMin,
        pomodorosPerChunk,
      }),
    );

  return { pomodoroMin, shortBreakMin, longBreakMin, pomodorosPerChunk, chunks };
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
