// Picks the next exercise of a section so the chance of solving it is about targetP (0.8): hard
// enough to learn from, easy enough to keep going (D17).

import { DEFAULT_GAME_CONFIG, type GameConfig } from './config.js';
import { logit, probability } from './model.js';
import { noteMeanTheta } from './replay.js';
import { sectionKey, type GameState, type SectionRef } from './types.js';
import { isClosingSection, type Exercise } from '../notes/exercises.js';

export type NextExercise =
  { type: 'catalog'; exercise: Exercise; targetB: number } | { type: 'generate'; targetB: number };

/** The section's θ, or where it would start (the note's mean, else 0) if it has no attempts yet. */
export function sectionTheta(state: GameState, ref: SectionRef): number {
  return (
    state.sections[sectionKey(ref.noteCode, ref.section)]?.theta ??
    noteMeanTheta(state.sections, ref.noteCode) ??
    0
  );
}

export function nextExercise(
  state: GameState,
  catalog: readonly Exercise[],
  ref: SectionRef,
  config: GameConfig = DEFAULT_GAME_CONFIG,
): NextExercise {
  const targetB = sectionTheta(state, ref) - logit(config.targetP);
  const noteTheta = noteMeanTheta(state.sections, ref.noteCode) ?? 0;

  // Only exercises never tried: a failed one comes back through the review queue, not right away.
  const candidates = catalog.filter(
    (e) =>
      e.noteCode === ref.noteCode &&
      e.section === ref.section &&
      state.exercises[e.id] === undefined &&
      (!isClosingSection(e.section) || probability(noteTheta, e.b0) >= config.bossUnlockP),
  );

  let best: Exercise | null = null;
  for (const exercise of candidates) {
    const distance = Math.abs(exercise.b0 - targetB);
    if (
      !best ||
      distance < Math.abs(best.b0 - targetB) ||
      (distance === Math.abs(best.b0 - targetB) && exercise.order < best.order)
    ) {
      best = exercise;
    }
  }

  if (best && Math.abs(best.b0 - targetB) < config.margin) {
    return { type: 'catalog', exercise: best, targetB };
  }
  return { type: 'generate', targetB };
}
