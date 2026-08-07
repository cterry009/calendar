import { describe, expect, it } from 'vitest';
import {
  computeHeuristicComplexity,
  difficultyFromComplexity,
  estimateTaskComplexity,
  loadComplexityFeedbackHistory,
  recordComplexityFeedbackSample,
} from './complexity';

describe('computeHeuristicComplexity', () => {
  it('returns the base score for neutral text with no signals', () => {
    expect(computeHeuristicComplexity({ title: 'Preparar informe mensual de equipo' })).toBe(5);
  });

  it('scores up for heavy-stem keywords, a structured multi-line description, and a long estimate', () => {
    const score = computeHeuristicComplexity({
      title: 'Investigar y diseñar la arquitectura de datos',
      description: 'Paso 1\nPaso 2\nPaso 3',
      estimatedMinutes: 200,
    });
    expect(score).toBe(10);
  });

  it('scores down for light-stem keywords, short text, and a quick estimate', () => {
    const score = computeHeuristicComplexity({ title: 'Llamar y confirmar', estimatedMinutes: 15 });
    expect(score).toBe(1);
  });

  it('is accent-insensitive (normalizes diacritics before matching stems)', () => {
    const withAccent = computeHeuristicComplexity({ title: 'Diseñar arquitectura' });
    const withoutAccent = computeHeuristicComplexity({ title: 'Disenar arquitectura' });
    expect(withAccent).toBe(withoutAccent);
  });

  it('ignores a zero or missing estimate rather than treating it as "very quick"', () => {
    const noEstimate = computeHeuristicComplexity({ title: 'Preparar informe mensual de equipo' });
    const zeroEstimate = computeHeuristicComplexity({
      title: 'Preparar informe mensual de equipo',
      estimatedMinutes: 0,
    });
    expect(zeroEstimate).toBe(noEstimate);
  });
});

describe('difficultyFromComplexity', () => {
  it('maps 1-3 to EASY', () => {
    expect(difficultyFromComplexity(1)).toBe('EASY');
    expect(difficultyFromComplexity(3)).toBe('EASY');
  });

  it('maps 4-7 to MEDIUM', () => {
    expect(difficultyFromComplexity(4)).toBe('MEDIUM');
    expect(difficultyFromComplexity(7)).toBe('MEDIUM');
  });

  it('maps 8-10 to HARD', () => {
    expect(difficultyFromComplexity(8)).toBe('HARD');
    expect(difficultyFromComplexity(10)).toBe('HARD');
  });
});

describe('estimateTaskComplexity', () => {
  const neutralSignals = { title: 'Preparar informe mensual de equipo' };

  it('equals the raw heuristic when there is no feedback history', () => {
    expect(estimateTaskComplexity(neutralSignals, [])).toBe(computeHeuristicComplexity(neutralSignals));
  });

  it('adjusts the heuristic by the average of the user\'s recent corrections', () => {
    const history = [
      { heuristic: 5, final: 8 },
      { heuristic: 5, final: 8 },
    ];
    // base 5 + average bias 3 = 8
    expect(estimateTaskComplexity(neutralSignals, history)).toBe(8);
  });

  it('clamps the adaptive bias so a few big corrections cannot swing the score unbounded', () => {
    const history = [
      { heuristic: 5, final: 10 },
      { heuristic: 5, final: 10 },
    ];
    // average bias would be 5, clamped to the MAX_ADAPTIVE_BIAS of 3 -> 5 + 3 = 8
    expect(estimateTaskComplexity(neutralSignals, history)).toBe(8);
  });

  it('only considers the most recent samples within the feedback window', () => {
    const staleNegative = Array.from({ length: 3 }, () => ({ heuristic: 5, final: 1 }));
    const recentPositive = Array.from({ length: 12 }, () => ({ heuristic: 5, final: 7 }));
    const history = [...staleNegative, ...recentPositive];

    // Only the last 12 (all +2 bias) should count, ignoring the 3 stale -4 bias samples.
    expect(estimateTaskComplexity(neutralSignals, history)).toBe(7);
  });
});

describe('complexity feedback storage (no window/localStorage available)', () => {
  it('loadComplexityFeedbackHistory returns an empty array', () => {
    expect(loadComplexityFeedbackHistory()).toEqual([]);
  });

  it('recordComplexityFeedbackSample still returns the appended sample without throwing', () => {
    expect(recordComplexityFeedbackSample(5, 8)).toEqual([{ heuristic: 5, final: 8 }]);
  });
});
