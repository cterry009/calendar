import type { Grade } from './model.js';
import type { ExerciseKind } from '../notes/exercises.js';

/**
 * One graded try at an exercise. Phase 2 turns it into a synced, immutable entity; here it is only
 * the input to `replay`. A generated exercise carries its own `b` and needn't be in the catalog.
 */
export interface ExerciseAttemptInput {
  id: string;
  exerciseId: string;
  exerciseSource: 'nota' | 'generado';
  noteCode: string;
  section: string;
  b: number;
  r: Grade;
  hints: number;
  minutes: number | null;
  gradedBy: 'claude' | 'usuario';
  /** The attempt this one corrects (D2): only the last grade counts. */
  supersedes: string | null;
  /** ISO date-time. */
  occurredAt: string;
}

export interface SectionRef {
  noteCode: string;
  section: string;
}

export interface SectionState extends SectionRef {
  theta: number;
  attempts: number;
  level: number;
}

export interface ExerciseProgress {
  attempts: number;
  lastR: Grade;
  /** Solved with r = 1 at least once. */
  solved: boolean;
}

export interface BossState {
  exerciseId: string;
  kind: Extract<ExerciseKind, 'dificil' | 'muy_dificil'>;
  b: number;
  unlocked: boolean;
  beaten: boolean;
}

export interface NoteGameState {
  noteCode: string;
  /** Mean θ of the note's non-closing sections with attempts; null before the first one. */
  meanTheta: number | null;
  bosses: BossState[];
  /** A 🔴 boss was beaten. */
  closed: boolean;
}

export interface ReviewItem extends SectionRef {
  exerciseId: string;
  /** When it was failed (the attempt that put it in the queue). */
  since: string;
}

/** What one effective attempt did, in replay order. */
export interface AttemptOutcome {
  /** The attempt whose grade counts (the last correction). */
  attemptId: string;
  exerciseId: string;
  sectionKey: string;
  r: Grade;
  thetaBefore: number;
  thetaAfter: number;
  p: number;
  xp: number;
  comboMultiplier: number;
  boss: boolean;
}

export interface GameState {
  /** Keyed by `sectionKey(noteCode, section)`, e.g. "AN1§3". */
  sections: Record<string, SectionState>;
  exercises: Record<string, ExerciseProgress>;
  notes: Record<string, NoteGameState>;
  xp: number;
  level: number;
  combo: { streak: number; multiplier: number; lastAttemptAt: string | null };
  review: ReviewItem[];
  outcomes: AttemptOutcome[];
}

export function sectionKey(noteCode: string, section: string): string {
  return `${noteCode}§${section}`;
}
