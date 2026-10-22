import { EXERCISE_B0, type Exercise, type ExerciseKind } from '../notes/exercises.js';
import { replay } from './replay.js';
import type { ExerciseAttemptInput } from './types.js';

function exercise(
  noteCode: string,
  section: string,
  n: string,
  kind: ExerciseKind,
  order: number,
): Exercise {
  return {
    id: `${noteCode}#${section}#${n}`,
    noteCode,
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
  exercise('AN1', '1', '1', 'sencillo', 0),
  exercise('AN1', '1', '2', 'medio', 1),
  exercise('AN1', '2', '1', 'sencillo', 2),
  exercise('AN1', 'cierre-rojo', 'D1', 'dificil', 3),
  exercise('AN1', 'cierre-negro', 'M1', 'muy_dificil', 4),
];

const T0 = Date.parse('2026-10-21T09:30:00Z');
let counter = 0;

/** An attempt at an exercise of CATALOG, `minutes` after 09:30. */
function attempt(
  exerciseId: string,
  r: 0 | 0.5 | 1,
  minutes: number,
  extra: Partial<ExerciseAttemptInput> = {},
): ExerciseAttemptInput {
  const ex = CATALOG.find((e) => e.id === exerciseId);
  const [noteCode, section] = exerciseId.split('#');
  counter += 1;
  return {
    id: `a${String(counter).padStart(3, '0')}`,
    exerciseId,
    exerciseSource: ex ? 'nota' : 'generado',
    noteCode,
    section,
    b: ex?.b0 ?? 0,
    r,
    hints: 0,
    minutes: null,
    gradedBy: 'claude',
    supersedes: null,
    occurredAt: new Date(T0 + minutes * 60_000).toISOString(),
    ...extra,
  };
}

/** Deterministic Fisher-Yates with a small LCG, so the shuffles are the same on every run. */
function shuffled<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed;
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

describe('replay', () => {
  it('gives the same state for the same history in any order', () => {
    const history = [
      attempt('AN1#1#1', 1, 0),
      attempt('AN1#1#2', 0, 5),
      attempt('AN1#2#1', 0.5, 10),
      attempt('AN1#gen-1', 1, 12, { b: 0.4 }),
      attempt('AN1#1#2', 1, 20),
      attempt('AN1#cierre-rojo#D1', 1, 30, { supersedes: null }),
    ];
    const expected = replay(history, CATALOG);
    for (const seed of [1, 2, 3, 4, 5]) {
      expect(replay(shuffled(history, seed), CATALOG)).toEqual(expected);
    }
    // A retried upload of the same attempt counts once.
    expect(replay([...history, history[2]], CATALOG)).toEqual(expected);
  });

  it('lets a correction replace the grade it supersedes, in its place', () => {
    const graded = attempt('AN1#1#2', 0, 0);
    const later = attempt('AN1#1#1', 1, 10);
    const correction = attempt('AN1#1#2', 1, 15, { supersedes: graded.id, gradedBy: 'usuario' });

    const corrected = replay([graded, later, correction], CATALOG);
    const asIfRight = replay([{ ...graded, r: 1 }, later], CATALOG);
    expect(corrected.sections).toEqual(asIfRight.sections);
    expect(corrected.xp).toBe(asIfRight.xp);
    expect(corrected.review).toEqual([]);
    expect(corrected.outcomes.map((o) => o.attemptId)).toEqual([correction.id, later.id]);
  });

  it('counts only the last link of a correction chain', () => {
    const first = attempt('AN1#1#1', 0, 0);
    const second = attempt('AN1#1#1', 1, 5, { supersedes: first.id });
    const third = attempt('AN1#1#1', 0.5, 6, { supersedes: second.id });
    const state = replay([third, first, second], CATALOG);
    expect(state.outcomes).toHaveLength(1);
    expect(state.outcomes[0]).toMatchObject({ attemptId: third.id, r: 0.5 });
  });

  it('treats a correction of an unknown attempt as a plain attempt', () => {
    const state = replay([attempt('AN1#1#1', 1, 0, { supersedes: 'missing' })], CATALOG);
    expect(state.outcomes).toHaveLength(1);
  });

  it('gives XP that does not decrease with the grade, and none for a failure', () => {
    const xpFor = (r: 0 | 0.5 | 1) => replay([attempt('AN1#1#2', r, 0)], CATALOG).xp;
    expect(xpFor(0)).toBe(0);
    expect(xpFor(0.5)).toBeGreaterThan(0);
    expect(xpFor(1)).toBeGreaterThanOrEqual(xpFor(0.5));
    // θ = 0 and b = 0: 10 · r · 2^0.
    expect(xpFor(1)).toBe(10);
    expect(xpFor(0.5)).toBe(5);
  });

  it('builds a combo within a block and resets it on a failure or a long pause', () => {
    const gen = (n: number, r: 0 | 1, minutes: number) =>
      attempt(`AN1#gen-${n}`, r, minutes, { section: '1', b: 0 });
    const state = replay([gen(1, 1, 0), gen(2, 1, 10), gen(3, 1, 20), gen(4, 0, 30)], CATALOG);
    expect(state.outcomes.map((o) => o.comboMultiplier)).toEqual([1, 1.1, 1.2, 1.3]);
    expect(state.combo.streak).toBe(0);

    const paused = replay([gen(1, 1, 0), gen(2, 1, 10), gen(3, 1, 200)], CATALOG);
    expect(paused.outcomes.map((o) => o.comboMultiplier)).toEqual([1, 1.1, 1]);

    const long = replay(
      Array.from({ length: 8 }, (_, i) => gen(i + 1, 1, i * 5)),
      CATALOG,
    );
    expect(Math.max(...long.outcomes.map((o) => o.comboMultiplier))).toBe(1.5);
  });

  it('starts a new section at the mean of the note’s sections already seen', () => {
    const state = replay(
      [attempt('AN1#1#1', 1, 0), attempt('AN1#1#2', 1, 5), attempt('AN1#2#1', 1, 10)],
      CATALOG,
    );
    const afterSection1 = state.outcomes[1].thetaAfter;
    expect(state.outcomes[2].thetaBefore).toBe(afterSection1);
    // Another note starts from 0.
    const other = replay([attempt('AN1#1#1', 1, 0), attempt('AN2#1#1', 1, 5)], CATALOG);
    expect(other.outcomes[1].thetaBefore).toBe(0);
  });

  it('keeps the bosses locked until the note is strong enough, then counts one beaten', () => {
    const fresh = replay([], CATALOG);
    expect(fresh.notes.AN1.bosses.map((b) => [b.exerciseId, b.unlocked])).toEqual([
      ['AN1#cierre-rojo#D1', false],
      ['AN1#cierre-negro#M1', false],
    ]);

    // Hard generated exercises solved in two sections lift the note's mean above 1.
    const strong = replay(
      Array.from({ length: 12 }, (_, i) =>
        attempt(`AN1#gen-${i}`, 1, i * 5, { section: i % 2 ? '1' : '2', b: 2 }),
      ),
      CATALOG,
    );
    expect(strong.notes.AN1.meanTheta!).toBeGreaterThanOrEqual(1);
    expect(strong.notes.AN1.bosses.find((b) => b.kind === 'dificil')!.unlocked).toBe(true);
    expect(strong.notes.AN1.closed).toBe(false);

    const beaten = replay([attempt('AN1#cierre-rojo#D1', 1, 0)], CATALOG);
    expect(beaten.notes.AN1.bosses[0]).toMatchObject({ beaten: true, unlocked: true });
    expect(beaten.notes.AN1.closed).toBe(true);
    // Boss XP is tripled: θ = 0, b = 1 -> 10 · 2^1 = 20, × 3.
    expect(beaten.xp).toBe(60);
  });

  it('queues a failed exercise for review until it is solved with r = 1', () => {
    const failed = attempt('AN1#1#2', 0, 0);
    expect(replay([failed], CATALOG).review).toEqual([
      { exerciseId: 'AN1#1#2', noteCode: 'AN1', section: '1', since: failed.occurredAt },
    ]);
    expect(replay([failed, attempt('AN1#1#2', 0.5, 10)], CATALOG).review).toHaveLength(1);
    expect(replay([failed, attempt('AN1#1#2', 1, 20)], CATALOG).review).toEqual([]);
  });

  it('adds up levels from θ and XP', () => {
    const state = replay([attempt('AN1#1#1', 1, 0)], CATALOG);
    expect(state.sections['AN1§1']).toMatchObject({ attempts: 1, level: 3 });
    expect(state.level).toBe(0);
  });

  it('rejects an invalid grade', () => {
    expect(() => replay([attempt('AN1#1#1', 0.7 as unknown as 1, 0)], CATALOG)).toThrow(
      /0, 0.5 or 1/,
    );
  });
});
