import { z } from 'zod';

// A graded try at a study exercise (server ExerciseAttempt, study-tutor-game phase 2, 2026-10-21).
// Same contract as FocusEvent: the client id is the idempotency key and a record never changes; a
// regrade is a new attempt that `supersedes` the old one. The parsed type is a valid `replay` input
// (ExerciseAttemptInput) plus the optional fields the pull leaves out or the tutor fills in.
export const ExerciseGradeSchema = z.union([z.literal(0), z.literal(0.5), z.literal(1)]);

export const ExerciseAttemptSchema = z.object({
  id: z.string().min(1).max(200),
  exerciseId: z.string().min(1).max(200),
  exerciseSource: z.enum(['nota', 'generado']),
  noteCode: z.string().min(1).max(200),
  section: z.string().min(1).max(200),
  b: z.number().finite().min(-6).max(6),
  r: ExerciseGradeSchema,
  hints: z.number().int().min(0).default(0),
  minutes: z.number().int().min(0).nullable().default(null),
  gradedBy: z.enum(['claude', 'usuario']),
  supersedes: z.string().max(200).nullable().default(null),
  occurredAt: z.string().datetime(),
  /** Not in the pull (GET /sync/exercise-attempts has it). */
  generatedStatement: z.string().max(20_000).nullable().optional(),
  /** Claude's justification of the grade; not in the pull either. */
  feedback: z.string().max(10_000).nullable().optional(),
  studyTaskId: z.string().nullable().optional(),
  pomodoroSessionId: z.string().nullable().optional(),
});

export type ExerciseAttempt = z.infer<typeof ExerciseAttemptSchema>;
