import type { ExerciseAttempt } from '@calendar/shared';
import type { SyncSnapshot } from '../calendar/types';
import { enqueueSyncItem, syncBatch } from '../offline/sync-client';

// The study game's attempts on the web (study-tutor-game phase 2, 2026-10-21). The game state is
// never stored: `replay` (@calendar/shared) rebuilds it from these. The server's tutor records
// Claude's grades; the web records the user's corrections (phase 4) through this logger.

/** The snapshot's attempts; a snapshot cached before 2026-10-21 has none. */
export function exerciseAttemptsOf(
  snapshot: Pick<SyncSnapshot, 'exerciseAttempts'>,
): ExerciseAttempt[] {
  return snapshot.exerciseAttempts ?? [];
}

export type ExerciseAttemptLogInput = Omit<ExerciseAttempt, 'id' | 'occurredAt'> & {
  occurredAt?: string;
};

/**
 * Records an attempt (a regrade is a new attempt with `supersedes`, never an edit). Offline it is
 * queued by syncBatch; a failed send while online is queued here too (unlike focus telemetry, a
 * user's correction must not be lost), and a resend is harmless since the id is the idempotency key.
 */
export function logExerciseAttempt(input: ExerciseAttemptLogInput): ExerciseAttempt {
  const { attempt, sent } = sendExerciseAttempt(input);
  void sent;
  return attempt;
}

/**
 * Same as `logExerciseAttempt`, plus `sent`: true once the server has it, false when it was queued.
 * The tutor panel waits for it before re-reading the game, so a correction shows at once (D42).
 */
export function sendExerciseAttempt(input: ExerciseAttemptLogInput): {
  attempt: ExerciseAttempt;
  sent: Promise<boolean>;
} {
  const attempt: ExerciseAttempt = {
    id: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    ...input,
  };
  const sent = syncBatch({ exerciseAttempts: [attempt] }).then(
    (response) => Boolean(response.applied.exerciseAttempts?.length),
    () =>
      enqueueSyncItem('exerciseAttempts', [attempt]).then(
        () => false,
        () => false,
      ),
  );
  return { attempt, sent };
}
