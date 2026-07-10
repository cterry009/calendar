import type { TaskDifficulty } from '@calendar/shared';

export interface ComplexitySignals {
  title: string;
  description?: string | null;
  estimatedMinutes?: number | null;
}

// Stems (not full words) so conjugations/plurals match too: "investigar", "investigando",
// "investigacion" all hit "investig". Heavy = open-ended, multi-step, or unfamiliar work.
// Light = quick, mechanical, single-step actions.
const HEAVY_STEMS = [
  'investig',
  'disen',
  'migra',
  'refactor',
  'planific',
  'coordin',
  'arquitect',
  'analiz',
  'optimiz',
  'integr',
  'implement',
  'audit',
  'estrateg',
  'negocia',
  'aprend',
  'document',
  'desarroll',
  'depura',
];

const LIGHT_STEMS = [
  'llam',
  'envi',
  'respond',
  'confirm',
  'agend',
  'record',
  'pag',
  'compr',
  'imprim',
  'archiv',
  'actualiz',
  'revisar',
  'chequ',
  'marcar',
];

const BASE_COMPLEXITY = 5;
const KEYWORD_SCORE_CLAMP = 3;
const MAX_ADAPTIVE_BIAS = 3;

const COMBINING_DIACRITICS_PATTERN = /[̀-ͯ]/g;

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(COMBINING_DIACRITICS_PATTERN, '');
}

function clampComplexity(value: number): number {
  return Math.min(10, Math.max(1, Math.round(value)));
}

function keywordScore(normalizedText: string): number {
  const heavyHits = HEAVY_STEMS.filter((stem) => normalizedText.includes(stem)).length;
  const lightHits = LIGHT_STEMS.filter((stem) => normalizedText.includes(stem)).length;
  const raw = heavyHits * 1.4 - lightHits * 1.2;
  return Math.min(KEYWORD_SCORE_CLAMP, Math.max(-KEYWORD_SCORE_CLAMP, raw));
}

function lengthScore(wordCount: number): number {
  if (wordCount <= 3) return -1;
  if (wordCount <= 8) return 0;
  if (wordCount <= 16) return 1;
  return 2;
}

function structureScore(description: string): number {
  const lines = description
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length >= 3 ? 1 : 0;
}

function durationScore(estimatedMinutes: number | null | undefined): number {
  if (!estimatedMinutes || estimatedMinutes <= 0) return 0;
  if (estimatedMinutes <= 20) return -1;
  if (estimatedMinutes <= 45) return 0;
  if (estimatedMinutes <= 90) return 1;
  if (estimatedMinutes <= 180) return 2;
  return 3;
}

/**
 * Deterministic, offline scoring based on keyword stems + text length + structure + estimated
 * duration -- no model, no network call. Same category of heuristic as text-readability formulas
 * (Flesch-Kincaid): combine cheap surface features into a bounded score.
 */
export function computeHeuristicComplexity(signals: ComplexitySignals): number {
  const title = signals.title ?? '';
  const description = signals.description ?? '';
  const normalized = normalize(`${title} ${description}`);
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;

  const score =
    BASE_COMPLEXITY +
    keywordScore(normalized) +
    lengthScore(wordCount) +
    structureScore(description) +
    durationScore(signals.estimatedMinutes);

  return clampComplexity(score);
}

export function difficultyFromComplexity(complexity: number): TaskDifficulty {
  if (complexity <= 3) return 'EASY';
  if (complexity <= 7) return 'MEDIUM';
  return 'HARD';
}

// ─── Adaptive adjustment from the user's own past corrections ───────────────

interface ComplexityFeedbackSample {
  heuristic: number;
  final: number;
}

const FEEDBACK_STORAGE_KEY = 'calendar:task-complexity-feedback';
const FEEDBACK_HISTORY_LIMIT = 30;
const FEEDBACK_SAMPLE_WINDOW = 12;

export function loadComplexityFeedbackHistory(): ComplexityFeedbackSample[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (value): value is ComplexityFeedbackSample =>
        typeof value === 'object' &&
        value !== null &&
        typeof (value as ComplexityFeedbackSample).heuristic === 'number' &&
        typeof (value as ComplexityFeedbackSample).final === 'number',
    );
  } catch {
    return [];
  }
}

/** Call with the raw heuristic score (not the already-adjusted estimate) to avoid bias-on-bias drift. */
export function recordComplexityFeedbackSample(heuristic: number, final: number): ComplexityFeedbackSample[] {
  const history = loadComplexityFeedbackHistory();
  const next = [...history, { heuristic, final }].slice(-FEEDBACK_HISTORY_LIMIT);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(next));
  }

  return next;
}

/**
 * Adjusts the raw heuristic by the average correction the user made on their own recent tasks
 * (heuristic suggested N, they kept/changed it to M) -- same "average of recent samples"
 * approach the pomodoro duration estimate uses, no training step or model involved.
 */
export function estimateTaskComplexity(
  signals: ComplexitySignals,
  history: ComplexityFeedbackSample[] = loadComplexityFeedbackHistory(),
): number {
  const base = computeHeuristicComplexity(signals);
  if (history.length === 0) return base;

  const recent = history.slice(-FEEDBACK_SAMPLE_WINDOW);
  const averageBias = recent.reduce((sum, sample) => sum + (sample.final - sample.heuristic), 0) / recent.length;
  const clampedBias = Math.min(MAX_ADAPTIVE_BIAS, Math.max(-MAX_ADAPTIVE_BIAS, averageBias));

  return clampComplexity(base + clampedBias);
}
