import type { ExerciseKind, GameState, NextExercise } from '@calendar/shared';
import { apiFetch } from '../api';

// The server's tutor (server/src/tutor, study-tutor-game phase 3). Types mirror its responses.

export interface TutorExercise {
  exerciseId: string;
  source: 'nota' | 'generado';
  noteCode: string;
  section: string;
  kind: ExerciseKind | null;
  b: number;
  title: string | null;
  statement: string;
  /** The reference answer: sent back on the next turn, never shown by the panel. */
  answer: string | null;
  hint: string | null;
}

export interface TutorSectionGame {
  noteCode: string;
  section: string;
  theta: number;
  level: number;
  attempts: number;
  xp: number;
  globalLevel: number;
  combo: number;
  review: GameState['review'];
  bosses: GameState['notes'][string]['bosses'];
}

export interface TutorStateResult extends TutorSectionGame {
  next: NextExercise;
}

export interface TutorAttempt {
  id: string;
  exerciseId: string;
  exerciseSource: 'nota' | 'generado';
  noteCode: string;
  section: string;
  b: number;
  r: 0 | 0.5 | 1;
  hints: number;
  minutes: number | null;
  gradedBy: 'claude' | 'usuario';
  supersedes: string | null;
  occurredAt: string;
  xpGained: number;
  thetaBefore: number;
  thetaAfter: number;
}

export type TutorAction = 'explicar' | 'proponer_ejercicio' | 'pista' | 'calificar';

export interface TutorTurnResult {
  sessionId: string;
  mensaje: string;
  accion: TutorAction;
  current: TutorExercise | null;
  generateAt: number | null;
  attempt: TutorAttempt | null;
  game: TutorSectionGame;
  warnings: string[];
  durationMs: number;
}

export interface TutorNoteSummary {
  noteCode: string;
  title: string;
  path: string;
  sections: { section: string; title: string; exercises: number }[];
}

export interface TutorTurnInput {
  noteCode: string;
  section: string;
  message: string;
  sessionId?: string;
  current?: Pick<TutorExercise, 'exerciseId' | 'source'> & {
    b?: number;
    statement?: string;
    answer?: string;
  };
  pomodoroSessionId?: string;
  studyTaskId?: string;
  /** Last chat messages: the tutor's memory if its session was lost. */
  history?: { role: 'user' | 'assistant'; text: string }[];
}

export function tutorNotes(): Promise<TutorNoteSummary[]> {
  return apiFetch<TutorNoteSummary[]>('/tutor/notes');
}

export function tutorState(noteCode: string, section: string): Promise<TutorStateResult> {
  const query = new URLSearchParams({ noteCode, section });
  return apiFetch<TutorStateResult>(`/tutor/state?${query.toString()}`);
}

export function tutorTurn(input: TutorTurnInput): Promise<TutorTurnResult> {
  return apiFetch<TutorTurnResult>('/tutor/turn', { method: 'POST', body: JSON.stringify(input) });
}

/** What goes back to the server as `current`: generated exercises carry their own text and b. */
export function currentForTurn(exercise: TutorExercise | null): TutorTurnInput['current'] {
  if (!exercise) return undefined;
  if (exercise.source === 'nota') return { exerciseId: exercise.exerciseId, source: 'nota' };
  return {
    exerciseId: exercise.exerciseId,
    source: 'generado',
    b: exercise.b,
    statement: exercise.statement,
    answer: exercise.answer ?? undefined,
  };
}
