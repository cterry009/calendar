// The whole game state, recomputed from the attempt history (event sourcing, D6): θ per section,
// levels, XP, combo, bosses and the review queue are never stored, so there is nothing to conflict
// across devices and new parameters recalibrate the past.

import { DEFAULT_GAME_CONFIG, type GameConfig } from './config.js';
import { globalLevel, probability, sectionLevel, updateTheta } from './model.js';
import {
  sectionKey,
  type AttemptOutcome,
  type BossState,
  type ExerciseAttemptInput,
  type GameState,
  type NoteGameState,
  type SectionState,
} from './types.js';
import { isClosingSection, type Exercise } from '../notes/exercises.js';

const MINUTE_MS = 60_000;

function compareAttempts(a: ExerciseAttemptInput, b: ExerciseAttemptInput): number {
  const byTime = Date.parse(a.occurredAt) - Date.parse(b.occurredAt);
  if (byTime !== 0) return byTime;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * The attempts whose grade counts, in replay order (D12). Duplicate ids count once. A correction
 * takes the place of the attempt it supersedes, so a regrade changes the past instead of adding a
 * new try at the end; a chain resolves to its latest link, and of two corrections of the same
 * attempt the later wins. A `supersedes` naming an unknown id is a plain attempt.
 */
export function effectiveAttempts(
  attempts: readonly ExerciseAttemptInput[],
): { attempt: ExerciseAttemptInput; at: ExerciseAttemptInput }[] {
  const byId = new Map<string, ExerciseAttemptInput>();
  for (const attempt of [...attempts].sort(compareAttempts)) {
    if (!byId.has(attempt.id)) byId.set(attempt.id, attempt);
  }

  const rootOf = (attempt: ExerciseAttemptInput): ExerciseAttemptInput => {
    let current = attempt;
    const seen = new Set<string>([current.id]);
    while (current.supersedes && byId.has(current.supersedes) && !seen.has(current.supersedes)) {
      current = byId.get(current.supersedes)!;
      seen.add(current.id);
    }
    return current;
  };

  const winnerByRoot = new Map<string, ExerciseAttemptInput>();
  for (const attempt of byId.values()) {
    const root = rootOf(attempt);
    const winner = winnerByRoot.get(root.id);
    if (!winner || compareAttempts(attempt, winner) > 0) winnerByRoot.set(root.id, attempt);
  }

  return [...winnerByRoot.entries()]
    .map(([rootId, attempt]) => ({ attempt, at: byId.get(rootId)! }))
    .sort((x, y) => compareAttempts(x.at, y.at));
}

/** Mean θ of a note's non-closing sections with attempts; null if none (cold start, D13). */
export function noteMeanTheta(
  sections: Record<string, SectionState>,
  noteCode: string,
): number | null {
  const thetas = Object.values(sections)
    .filter((s) => s.noteCode === noteCode && !isClosingSection(s.section) && s.attempts > 0)
    .map((s) => s.theta);
  return thetas.length ? thetas.reduce((a, b) => a + b, 0) / thetas.length : null;
}

export function replay(
  attempts: readonly ExerciseAttemptInput[],
  catalog: readonly Exercise[],
  config: GameConfig = DEFAULT_GAME_CONFIG,
): GameState {
  const sections: Record<string, SectionState> = {};
  const exercises: GameState['exercises'] = {};
  const beaten = new Set<string>();
  const closedNotes = new Set<string>();
  const review = new Map<string, GameState['review'][number]>();
  const outcomes: AttemptOutcome[] = [];
  let xp = 0;
  let streak = 0;
  let lastAt: number | null = null;
  let lastAttemptAt: string | null = null;

  for (const { attempt, at } of effectiveAttempts(attempts)) {
    const key = sectionKey(attempt.noteCode, attempt.section);
    let section = sections[key];
    if (!section) {
      // A new section starts where the rest of the note is, not at 0 (D13).
      const theta = noteMeanTheta(sections, attempt.noteCode) ?? 0;
      section = {
        noteCode: attempt.noteCode,
        section: attempt.section,
        theta,
        attempts: 0,
        level: 0,
      };
      sections[key] = section;
    }

    const time = Date.parse(at.occurredAt);
    if (lastAt !== null && time - lastAt > config.comboGapMinutes * MINUTE_MS) streak = 0;
    const comboMultiplier = Math.min(config.comboMax, 1 + config.comboStep * streak);
    const boss = isClosingSection(attempt.section);

    const thetaBefore = section.theta;
    const thetaAfter = updateTheta(thetaBefore, attempt.b, attempt.r, section.attempts, config);
    // A failure earns nothing: the game rewards solving, not trying many times.
    const base =
      attempt.r === 0
        ? 0
        : Math.min(
            config.xpMax,
            Math.max(
              config.xpMin,
              Math.round(config.xpBase * attempt.r * 2 ** (attempt.b - thetaBefore)),
            ),
          );
    const gained = Math.round(base * comboMultiplier * (boss ? config.bossMultiplier : 1));

    section.theta = thetaAfter;
    section.attempts += 1;
    xp += gained;
    streak = attempt.r >= 0.5 ? streak + 1 : 0;
    lastAt = time;
    lastAttemptAt = at.occurredAt;

    const progress = exercises[attempt.exerciseId];
    exercises[attempt.exerciseId] = {
      attempts: (progress?.attempts ?? 0) + 1,
      lastR: attempt.r,
      solved: (progress?.solved ?? false) || attempt.r === 1,
    };

    if (attempt.r === 0 && !review.has(attempt.exerciseId)) {
      review.set(attempt.exerciseId, {
        exerciseId: attempt.exerciseId,
        noteCode: attempt.noteCode,
        section: attempt.section,
        since: at.occurredAt,
      });
    } else if (attempt.r === 1) {
      review.delete(attempt.exerciseId);
    }

    if (boss && attempt.r === 1) {
      beaten.add(attempt.exerciseId);
      if (attempt.section === 'cierre-rojo') closedNotes.add(attempt.noteCode);
    }

    outcomes.push({
      attemptId: attempt.id,
      exerciseId: attempt.exerciseId,
      sectionKey: key,
      r: attempt.r,
      thetaBefore,
      thetaAfter,
      p: probability(thetaBefore, attempt.b),
      xp: gained,
      comboMultiplier,
      boss,
    });
  }

  for (const section of Object.values(sections))
    section.level = sectionLevel(section.theta, config);

  const noteCodes = new Set<string>([
    ...catalog.filter((e) => isClosingSection(e.section)).map((e) => e.noteCode),
    ...Object.values(sections).map((s) => s.noteCode),
  ]);
  const notes: Record<string, NoteGameState> = {};
  for (const noteCode of [...noteCodes].sort()) {
    const meanTheta = noteMeanTheta(sections, noteCode);
    const bosses: BossState[] = catalog
      .filter((e) => e.noteCode === noteCode && (e.kind === 'dificil' || e.kind === 'muy_dificil'))
      .map((e) => ({
        exerciseId: e.id,
        kind: e.kind as BossState['kind'],
        b: e.b0,
        unlocked: beaten.has(e.id) || probability(meanTheta ?? 0, e.b0) >= config.bossUnlockP,
        beaten: beaten.has(e.id),
      }));
    notes[noteCode] = { noteCode, meanTheta, bosses, closed: closedNotes.has(noteCode) };
  }

  return {
    sections,
    exercises,
    notes,
    xp,
    level: globalLevel(xp, config),
    combo: {
      streak,
      multiplier: Math.min(config.comboMax, 1 + config.comboStep * streak),
      lastAttemptAt,
    },
    review: [...review.values()],
    outcomes,
  };
}
