import type { HabitRecordStatus, HabitType } from '../schemas/enums.js';

// Score curve and day-scoring rules ported from mhabit
// (https://github.com/FriesI23/mhabit, Apache 2.0) — lib/models/_score/{calculator,score}.dart
// and lib/models/habit_daily_record_form.dart. The math and branch structure are kept faithful
// to the source (renaming would risk silently flipping the NEGATIVE-habit semantics, which are
// genuinely non-obvious); only the syntax and the day-scanning strategy are native TypeScript.
// Unlike mhabit — which replays every calendar day client-side — this only iterates over actual
// HabitRecord rows, batching the "no record" decay for the gaps between them; this is equivalent
// because a day without a record always decays at the same flat rate in the source algorithm.

const SIGMOID_K = 0.4;
const SIGMOID_MIN_X = -10;
const SIGMOID_MAX_X = 10;

const SCORE_ZERO = 0;
const SCORE_NORMAL = 1;
const SCORE_EXTRA_MAX = 1.5;

const DAY_MS = 24 * 60 * 60 * 1000;

function intervalTrans(
  x: number,
  fromMin: number,
  fromMax: number,
  toMin: number,
  toMax: number,
): number {
  return ((toMax - toMin) * (x - fromMin)) / (fromMax - fromMin) + toMin;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-SIGMOID_K * x));
}

function rawGrowCurve(x: number, days: number): number {
  return sigmoid(intervalTrans(x, 0, days, SIGMOID_MIN_X, SIGMOID_MAX_X));
}

function rawGrowCurveInverse(y: number, days: number): number {
  const x = -Math.log(1 / y - 1) / SIGMOID_K;
  return intervalTrans(x, SIGMOID_MIN_X, SIGMOID_MAX_X, 0, days);
}

export interface HabitScoreCurve {
  /** Consolidated days of progress (0..targetDays, can overflow past it) -> score (0..100, can overflow past it). */
  toScore(consolidatedDays: number): number;
  /** Inverse of toScore. */
  toDays(score: number): number;
}

/** A sigmoid growth curve calibrated so 0 days -> score 0 and targetDays -> score 100. */
export function createHabitScoreCurve(targetDays: number): HabitScoreCurve {
  const lower = rawGrowCurve(0, targetDays);
  const upper = rawGrowCurve(targetDays, targetDays);
  return {
    toScore(consolidatedDays) {
      return intervalTrans(rawGrowCurve(consolidatedDays, targetDays), lower, upper, 0, 100);
    },
    toDays(score) {
      return rawGrowCurveInverse(intervalTrans(score, 0, 100, lower, upper), targetDays);
    },
  };
}

export type HabitCompletionTier = 'ZERO' | 'TRYHARD' | 'OK' | 'GOODJOB' | 'NO_EFFECT';

/**
 * How well a single day's logged value met the habit's daily goal. Tier meaning differs by type:
 * - NORMAL (build a habit): higher value is better. GOODJOB = exceeded the goal, OK = met it
 *   exactly, TRYHARD = partial effort, ZERO = nothing logged.
 * - NEGATIVE (avoid a habit): dailyGoalValue is the strict/preferred ceiling and
 *   dailyGoalExtraValue an extended tolerance ceiling; mild lapses within that band are forgiven
 *   (GOODJOB), only blowing past the extended ceiling is punished (TRYHARD). NO_EFFECT/ZERO cover
 *   lapses below the strict ceiling that still get no credit.
 */
export function getCompletionTier(
  type: HabitType,
  value: number,
  dailyGoalValue: number,
  dailyGoalExtraValue?: number | null,
): HabitCompletionTier {
  if (type === 'NORMAL') {
    if (value > dailyGoalValue) return 'GOODJOB';
    if (value === dailyGoalValue) return 'OK';
    if (value > 0) return 'TRYHARD';
    return 'ZERO';
  }

  const max = dailyGoalExtraValue ?? dailyGoalValue;
  if (value > max) return 'TRYHARD';
  if (value === max) return 'OK';
  if (value >= dailyGoalValue) return 'GOODJOB';
  if (value === 0) return 'ZERO';
  return 'NO_EFFECT';
}

function extraBonus(
  type: HabitType,
  value: number,
  dailyGoalValue: number,
  dailyGoalExtraValue?: number | null,
): number {
  if (type === 'NORMAL') {
    const extendedRatio =
      dailyGoalExtraValue != null ? Math.max(dailyGoalExtraValue / dailyGoalValue, 1) : SCORE_EXTRA_MAX;
    if (extendedRatio <= 1) return SCORE_NORMAL; // no headroom configured; avoid dividing by zero
    const result =
      ((SCORE_EXTRA_MAX - 1) / (extendedRatio - 1)) * (Math.max(value / dailyGoalValue, 1) - 1) + 1;
    return Math.min(result, SCORE_EXTRA_MAX);
  }

  const min = dailyGoalValue;
  const max = dailyGoalExtraValue ?? dailyGoalValue;
  if (value < min || value > max) return SCORE_ZERO;
  if (value === max) return SCORE_NORMAL;
  if (value === min) return SCORE_EXTRA_MAX;
  const progress = (value - min) / (max - min);
  return SCORE_EXTRA_MAX - progress * (SCORE_EXTRA_MAX - SCORE_NORMAL);
}

interface DayContext {
  hasRecord: boolean;
  status?: HabitRecordStatus;
  value?: number;
  autoCompleted?: boolean;
}

function decreaseRate(
  type: HabitType,
  targetDays: number,
  dailyGoalValue: number,
  dailyGoalExtraValue: number | null | undefined,
  ctx: DayContext,
): number {
  if (ctx.autoCompleted) return 0;
  const rateZero = -100 / targetDays;
  if (!ctx.hasRecord) return rateZero;
  if (ctx.status === 'SKIPPED') return 0;

  const tier = getCompletionTier(type, ctx.value ?? 0, dailyGoalValue, dailyGoalExtraValue);
  const ratePartial = rateZero / 2;

  if (type === 'NORMAL') {
    if (tier === 'ZERO') return rateZero;
    if (tier === 'TRYHARD') return ratePartial;
    return 0; // OK or GOODJOB
  }

  if (tier === 'NO_EFFECT') return 0;
  if (tier === 'TRYHARD') return ratePartial;
  return 0; // ZERO, OK, or GOODJOB
}

function increaseDays(
  type: HabitType,
  dailyGoalValue: number,
  dailyGoalExtraValue: number | null | undefined,
  ctx: DayContext,
): number {
  const value = ctx.value ?? 0;
  const done = ctx.hasRecord && ctx.status === 'DONE';

  if (ctx.autoCompleted) {
    if (!done) return SCORE_NORMAL;
    const tier = getCompletionTier(type, value, dailyGoalValue, dailyGoalExtraValue);
    return tier === 'GOODJOB' ? extraBonus(type, value, dailyGoalValue, dailyGoalExtraValue) : SCORE_NORMAL;
  }

  if (!done) return SCORE_ZERO;
  const tier = getCompletionTier(type, value, dailyGoalValue, dailyGoalExtraValue);
  if (tier === 'OK') return SCORE_NORMAL;
  if (tier === 'GOODJOB') return extraBonus(type, value, dailyGoalValue, dailyGoalExtraValue);
  return SCORE_ZERO;
}

function toEpochDay(iso: string): number {
  return Math.floor(new Date(iso).getTime() / DAY_MS);
}

function clampScore(score: number): number {
  return Math.min(Math.max(score, 0), 100);
}

export interface HabitScoreRecordInput {
  date: string;
  value: number;
  status: HabitRecordStatus;
  autoCompleted: boolean;
}

export interface HabitScoreInput {
  type: HabitType;
  targetDays: number;
  dailyGoalValue: number;
  dailyGoalExtraValue?: number | null;
  createdAt: string;
  records: HabitScoreRecordInput[];
  /** Defaults to now; the replay's end date (inclusive). */
  asOf?: string;
}

/**
 * Replays the full record history from habit creation to `asOf` (default: now) and returns the
 * current score (0-100). Deliberately not cached/persisted — call this fresh whenever a habit's
 * score needs to be displayed, same as mhabit does client-side.
 */
export function computeHabitScore(input: HabitScoreInput): number {
  const { type, targetDays, dailyGoalValue, dailyGoalExtraValue } = input;
  const curve = createHabitScoreCurve(targetDays);
  const endEpochDay = toEpochDay(input.asOf ?? new Date().toISOString());

  const sortedRecords = input.records
    .map((record) => ({ record, epochDay: toEpochDay(record.date) }))
    .sort((a, b) => a.epochDay - b.epochDay);

  let score = 0;
  let cursorEpochDay = toEpochDay(input.createdAt);

  for (const { record, epochDay } of sortedRecords) {
    if (epochDay > endEpochDay) break;
    if (epochDay < cursorEpochDay) continue;

    const gapDays = Math.max(0, epochDay - cursorEpochDay);
    score = clampScore(
      score + gapDays * decreaseRate(type, targetDays, dailyGoalValue, dailyGoalExtraValue, { hasRecord: false }),
    );

    const dayCtx: DayContext = {
      hasRecord: true,
      status: record.status,
      value: record.value,
      autoCompleted: record.autoCompleted,
    };

    score = clampScore(
      score + decreaseRate(type, targetDays, dailyGoalValue, dailyGoalExtraValue, dayCtx),
    );

    const days = Math.max(
      0,
      curve.toDays(score) + increaseDays(type, dailyGoalValue, dailyGoalExtraValue, dayCtx),
    );
    score = curve.toScore(days);
    if (score > 100) return 100; // habit fully consolidated; mhabit stops the replay here too

    cursorEpochDay = epochDay + 1;
  }

  const tailGapDays = Math.max(0, endEpochDay - cursorEpochDay + 1);
  score = clampScore(
    score + tailGapDays * decreaseRate(type, targetDays, dailyGoalValue, dailyGoalExtraValue, { hasRecord: false }),
  );

  return score;
}
