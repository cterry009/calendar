// Every tunable number of the study game in one place (openspec/changes/study-tutor-game,
// 2026-10-20). The game state is never stored, only replayed from the attempts (D6), so changing a
// value here recalibrates the whole history.

export interface GameConfig {
  /** θ step at the first attempt of a section: K = max(kMin, k0 / sqrt(1 + n)). */
  k0: number;
  /** Floor of the step, so a section never stops moving. */
  kMin: number;
  /** Success probability the next exercise aims at (Wilson et al. 2019: ~85%). */
  targetP: number;
  /** A catalog exercise is offered only within this distance of the target b; else one is generated. */
  margin: number;
  /** XP of a solved exercise as hard as the user (b = θ): xpBase · r · 2^(b − θ). */
  xpBase: number;
  xpMin: number;
  xpMax: number;
  /** Combo multiplier: 1 + comboStep per previous consecutive attempt with r ≥ 0.5, up to comboMax. */
  comboStep: number;
  comboMax: number;
  /** A longer gap between attempts (about one work block) resets the combo. */
  comboGapMinutes: number;
  /** XP multiplier for a closing problem (a boss). */
  bossMultiplier: number;
  /** Global level n needs levelXpBase · n^levelXpExponent XP. */
  levelXpBase: number;
  levelXpExponent: number;
  /** A boss unlocks when the note's mean θ gives at least this chance of solving it. */
  bossUnlockP: number;
  /** θ where section levels 2, 3, 4, 5 start: the b₀ of 🟢, 🟡, 🔴, ⚫ (D15). */
  sectionLevelThresholds: number[];
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  k0: 0.8,
  kMin: 0.15,
  targetP: 0.8,
  margin: 0.75,
  xpBase: 10,
  xpMin: 1,
  xpMax: 100,
  comboStep: 0.1,
  comboMax: 1.5,
  comboGapMinutes: 90,
  bossMultiplier: 3,
  levelXpBase: 100,
  levelXpExponent: 1.5,
  bossUnlockP: 0.5,
  sectionLevelThresholds: [-1, 0, 1, 2],
};
