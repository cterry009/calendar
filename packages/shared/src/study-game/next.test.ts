import { DEFAULT_GAME_CONFIG } from './config.js';
import { EXERCISE_B0, type Exercise, type ExerciseKind } from '../notes/exercises.js';
import { logit, probability } from './model.js';
import { nextExercise } from './next.js';
import { replay } from './replay.js';
import type { ExerciseAttemptInput, SectionRef } from './types.js';

function exercise(section: string, n: string, kind: ExerciseKind, order: number): Exercise {
  return {
    id: `AN1#${section}#${n}`,
    noteCode: 'AN1',
    section,
    kind,
    b0: EXERCISE_B0[kind],
    title: null,
    statement: '',
    answer: null,
    hint: null,
    order,
  };
}

const CATALOG: Exercise[] = [
  exercise('1', '1', 'sencillo', 0),
  exercise('1', '2', 'sencillo', 1),
  exercise('1', '3', 'medio', 2),
  exercise('1', '4', 'vf', 3),
  exercise('cierre-rojo', 'D1', 'dificil', 4),
];
const SECTION_1: SectionRef = { noteCode: 'AN1', section: '1' };

function attemptAt(
  ex: { id: string; section: string; b: number },
  r: 0 | 0.5 | 1,
  i: number,
  id = `a${String(i).padStart(4, '0')}`,
): ExerciseAttemptInput {
  return {
    id,
    exerciseId: ex.id,
    exerciseSource: CATALOG.some((e) => e.id === ex.id) ? 'nota' : 'generado',
    noteCode: 'AN1',
    section: ex.section,
    b: ex.b,
    r,
    hints: 0,
    minutes: null,
    gradedBy: 'claude',
    supersedes: null,
    occurredAt: new Date(Date.parse('2026-10-21T09:30:00Z') + i * 60_000).toISOString(),
  };
}

const TARGET_OFFSET = logit(0.8);

describe('nextExercise', () => {
  it('aims at an 80% chance: b* = θ − logit(0.8), nearest exercise first, ties by order', () => {
    const next = nextExercise(replay([], CATALOG), CATALOG, SECTION_1);
    // θ = 0 -> b* ≈ −1.39: the V/F (−1.5) is nearer than the 🟢 (−1).
    expect(next).toEqual({ type: 'catalog', exercise: CATALOG[3], targetB: -TARGET_OFFSET });
    // Without it, the two 🟢 tie and the first in the note wins.
    const noVf = CATALOG.filter((e) => e.kind !== 'vf');
    const tie = nextExercise(replay([], noVf), noVf, SECTION_1);
    expect(tie.type === 'catalog' && tie.exercise.id).toBe('AN1#1#1');
  });

  it('never offers an exercise already tried, solved or not', () => {
    let attempts = [attemptAt({ ...CATALOG[0], b: CATALOG[0].b0 }, 1, 0)];
    let next = nextExercise(replay(attempts, CATALOG), CATALOG, SECTION_1);
    expect(next.type === 'catalog' && next.exercise.id).not.toBe('AN1#1#1');

    attempts = [...attempts, attemptAt({ ...CATALOG[1], b: CATALOG[1].b0 }, 0, 1)];
    const state = replay(attempts, CATALOG);
    next = nextExercise(state, CATALOG, SECTION_1);
    expect(next.type === 'catalog' && ['AN1#1#1', 'AN1#1#2'].includes(next.exercise.id)).toBe(
      false,
    );
    // The failed one waits in the review queue instead.
    expect(state.review.map((r) => r.exerciseId)).toEqual(['AN1#1#2']);
  });

  it('asks for a generated exercise when the section is used up', () => {
    const attempts = CATALOG.filter((e) => e.section === '1').map((e, i) =>
      attemptAt({ ...e, b: e.b0 }, 1, i),
    );
    const state = replay(attempts, CATALOG);
    const theta = state.sections['AN1§1'].theta;
    expect(nextExercise(state, CATALOG, SECTION_1)).toEqual({
      type: 'generate',
      targetB: theta - TARGET_OFFSET,
    });
  });

  it('asks for a generated exercise when nothing left is close enough to the target', () => {
    // Strong in section 1 after hard generated wins: b* is far above the 🟢 and the V/F.
    const attempts = Array.from({ length: 10 }, (_, i) =>
      attemptAt({ id: `AN1#gen-${i}`, section: '1', b: 2 }, 1, i),
    );
    const next = nextExercise(replay(attempts, CATALOG), CATALOG, SECTION_1);
    expect(next.type).toBe('generate');
  });

  it('does not offer a locked boss', () => {
    const closing: SectionRef = { noteCode: 'AN1', section: 'cierre-rojo' };
    const fresh = replay([], CATALOG);
    expect(probability(0, 1)).toBeLessThan(0.5);
    expect(nextExercise(fresh, CATALOG, closing).type).toBe('generate');

    // Once the note's mean θ reaches the boss's b, it is offered.
    const attempts = Array.from({ length: 12 }, (_, i) =>
      attemptAt({ id: `AN1#gen-${i}`, section: '1', b: 2.5 }, 1, i),
    );
    const strong = replay(attempts, CATALOG);
    expect(strong.notes.AN1.meanTheta!).toBeGreaterThanOrEqual(1);
    // Its b (1) can sit more than the margin away from a strong section's b*, so widen the margin
    // to check only that it is eligible now.
    const next = nextExercise(strong, CATALOG, closing, { ...DEFAULT_GAME_CONFIG, margin: 10 });
    expect(next.type === 'catalog' && next.exercise.id).toBe('AN1#cierre-rojo#D1');
  });
});

// Seeded "students" (D18). With 0/1 answers at p ≈ 0.8, 60 attempts leave an RMSE of about 0.35 on
// θ, so the bar is a share of students, not "every seed" (simulated 2026-10-21: ≥ 75 of 100 within
// 0.5 holds for ~99% of seed sets; the mean bias is ≈ −0.08 because climbing is slow at p* = 0.8).
describe('convergence with simulated students', () => {
  function mulberry32(seed: number): () => number {
    let a = seed;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const random = mulberry32(20261021);
  const STUDENTS = 100;
  const ATTEMPTS = 60;
  const results: { real: number; estimate: number }[] = [];
  let successes = 0;

  for (let s = 0; s < STUDENTS; s += 1) {
    const real = -2 + 4 * random();
    const attempts: ExerciseAttemptInput[] = [];
    let state = replay(attempts, CATALOG);
    for (let i = 0; i < ATTEMPTS; i += 1) {
      const next = nextExercise(state, CATALOG, SECTION_1);
      const ex =
        next.type === 'catalog'
          ? { id: next.exercise.id, section: '1', b: next.exercise.b0 }
          : { id: `AN1#gen-${s}-${i}`, section: '1', b: next.targetB };
      const r = random() < probability(real, ex.b) ? 1 : 0;
      successes += r;
      attempts.push(attemptAt(ex, r, i, `s${s}-${String(i).padStart(3, '0')}`));
      state = replay(attempts, CATALOG);
    }
    results.push({ real, estimate: state.sections['AN1§1'].theta });
  }

  it('ends within 0.5 of the true θ for at least 75 of 100 students', () => {
    const close = results.filter((x) => Math.abs(x.estimate - x.real) < 0.5).length;
    expect(close).toBeGreaterThanOrEqual(75);
  });

  it('keeps the success rate over all attempts at 0.8 ± 0.03', () => {
    const rate = successes / (STUDENTS * ATTEMPTS);
    expect(rate).toBeGreaterThan(0.77);
    expect(rate).toBeLessThan(0.83);
  });

  it('has a mean bias below 0.15', () => {
    const bias = results.reduce((sum, x) => sum + (x.estimate - x.real), 0) / STUDENTS;
    expect(Math.abs(bias)).toBeLessThan(0.15);
  });
});
