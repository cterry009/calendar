// The adaptive model behind the study game: Rasch probability and an Elo-style ability update, per
// note section. The model (Claude) grades; this code decides θ (D5).

import { DEFAULT_GAME_CONFIG, type GameConfig } from './config.js';

export type Grade = 0 | 0.5 | 1;

/** P(solving an exercise of difficulty b) for ability θ: σ(θ − b). */
export function probability(theta: number, b: number): number {
  return 1 / (1 + Math.exp(-(theta - b)));
}

export function logit(p: number): number {
  return Math.log(p / (1 - p));
}

export function isGrade(r: unknown): r is Grade {
  return r === 0 || r === 0.5 || r === 1;
}

/** Step size: large while a section has few attempts, then down to kMin. */
export function stepSize(attemptsSoFar: number, config: GameConfig = DEFAULT_GAME_CONFIG): number {
  return Math.max(config.kMin, config.k0 / Math.sqrt(1 + attemptsSoFar));
}

/** θ + K·(r − p). r is 1 (solved alone), 0.5 (with a hint or a minor slip) or 0; anything else throws. */
export function updateTheta(
  theta: number,
  b: number,
  r: number,
  attemptsSoFar: number,
  config: GameConfig = DEFAULT_GAME_CONFIG,
): number {
  if (!isGrade(r)) throw new Error(`A grade must be 0, 0.5 or 1 (got ${r})`);
  return theta + stepSize(attemptsSoFar, config) * (r - probability(theta, b));
}

/** Section level from θ: 1 below the first threshold, then one more per threshold reached (D15). */
export function sectionLevel(theta: number, config: GameConfig = DEFAULT_GAME_CONFIG): number {
  return 1 + config.sectionLevelThresholds.filter((t) => theta >= t).length;
}

/** XP needed for global level n. */
export function xpForLevel(level: number, config: GameConfig = DEFAULT_GAME_CONFIG): number {
  return config.levelXpBase * level ** config.levelXpExponent;
}

/** The largest n with xpForLevel(n) ≤ xp; 0 before the first level. */
export function globalLevel(xp: number, config: GameConfig = DEFAULT_GAME_CONFIG): number {
  let level = Math.max(0, Math.floor((xp / config.levelXpBase) ** (1 / config.levelXpExponent)));
  // Guard the float rounding at exact boundaries (e.g. 800 XP = level 4).
  while (xpForLevel(level + 1, config) <= xp) level += 1;
  while (level > 0 && xpForLevel(level, config) > xp) level -= 1;
  return level;
}
