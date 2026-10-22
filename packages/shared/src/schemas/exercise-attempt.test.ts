import { ExerciseAttemptSchema, type ExerciseAttempt } from './exercise-attempt.js';
import { replay } from '../study-game/replay.js';
import type { ExerciseAttemptInput } from '../study-game/types.js';

// A synced attempt goes straight into replay: this fails to compile if the shapes drift apart.
const asReplayInput = (attempt: ExerciseAttempt): ExerciseAttemptInput => attempt;

const pulled = {
  id: 'ea-1',
  exerciseId: 'AN1#3#2',
  exerciseSource: 'nota',
  noteCode: 'AN1',
  section: '3',
  b: 0,
  r: 1,
  hints: 0,
  minutes: null,
  gradedBy: 'claude',
  supersedes: null,
  studyTaskId: null,
  pomodoroSessionId: null,
  occurredAt: '2026-10-21T14:30:00.000Z',
  userId: 'u1',
  createdAt: '2026-10-21T14:30:01.000Z',
};

describe('ExerciseAttemptSchema', () => {
  it('reads a pulled attempt (no texts, extra server fields dropped) as a replay input', () => {
    const attempt = ExerciseAttemptSchema.parse(pulled);
    expect(attempt).not.toHaveProperty('userId');
    expect(replay([asReplayInput(attempt)], []).xp).toBe(10);
  });

  it('fills the defaults of a minimal attempt', () => {
    const { hints, minutes, supersedes, ...minimal } = pulled;
    expect([hints, minutes, supersedes]).toEqual([0, null, null]);
    expect(ExerciseAttemptSchema.parse(minimal)).toMatchObject({
      hints: 0,
      minutes: null,
      supersedes: null,
    });
  });

  it('rejects a grade other than 0, 0.5 or 1 and a b out of range', () => {
    expect(ExerciseAttemptSchema.safeParse({ ...pulled, r: 0.7 }).success).toBe(false);
    expect(ExerciseAttemptSchema.safeParse({ ...pulled, b: 7 }).success).toBe(false);
    expect(ExerciseAttemptSchema.safeParse({ ...pulled, gradedBy: 'gemini' }).success).toBe(false);
  });
});
