import type { TaskDifficulty } from '../schemas/enums.js';

export interface TaskEstimateRecord {
  difficulty: TaskDifficulty;
  estimatedMinutes: number;
  actualMinutes: number;
}

export interface DifficultyAccuracy {
  avgErrorPct: number;
  count: number;
  tendency: 'underestimate' | 'overestimate' | 'balanced';
}

export interface EstimationAccuracyReport {
  overall: DifficultyAccuracy;
  byDifficulty: Record<TaskDifficulty, DifficultyAccuracy>;
}

const DIFFICULTIES: TaskDifficulty[] = ['EASY', 'MEDIUM', 'HARD'];

export function calculateEstimationErrorPct(
  estimatedMinutes: number,
  actualMinutes: number,
): number {
  if (estimatedMinutes <= 0) {
    return 0;
  }
  return ((actualMinutes - estimatedMinutes) / estimatedMinutes) * 100;
}

function summarize(records: TaskEstimateRecord[]): DifficultyAccuracy {
  if (records.length === 0) {
    return { avgErrorPct: 0, count: 0, tendency: 'balanced' };
  }

  const avgErrorPct =
    records.reduce(
      (sum, record) =>
        sum + calculateEstimationErrorPct(record.estimatedMinutes, record.actualMinutes),
      0,
    ) / records.length;

  const tendency =
    avgErrorPct > 10 ? 'underestimate' : avgErrorPct < -10 ? 'overestimate' : 'balanced';

  return {
    avgErrorPct: round(avgErrorPct),
    count: records.length,
    tendency,
  };
}

export function calculateEstimationAccuracy(
  records: TaskEstimateRecord[],
): EstimationAccuracyReport {
  const byDifficulty = Object.fromEntries(
    DIFFICULTIES.map((difficulty) => [
      difficulty,
      summarize(records.filter((record) => record.difficulty === difficulty)),
    ]),
  ) as Record<TaskDifficulty, DifficultyAccuracy>;

  return {
    overall: summarize(records),
    byDifficulty,
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
