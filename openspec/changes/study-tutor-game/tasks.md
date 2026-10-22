Phase 1 only (catalog + engine in `packages/shared`). Phases 2-5 (data, tutor, UI, MCP) get their tasks
when phase 1 closes; see proposal.md.

## 1. Exercise catalog

- [ ] 1.1 `src/notes/exercises.ts`: `Exercise` type and `parseExercises(fileName, markdown)` for 🟢/🟡 exercises in `## N.` sections and `### N.` sections under `## Desarrollo`, with statement/answer separation (D7, D8, D10)
- [ ] 1.2 True/false callouts as one `vf` exercise each, claims without verdicts as statement (D9)
- [ ] 1.3 🔴/⚫ closings: `D1`/`M1` labels, optional title, hint and solution
- [ ] 1.4 Jest tests with short fixtures copied from the real format (ids, b₀, LaTeX intact, answer and hint apart, sections under Desarrollo, re-parse equality)
- [ ] 1.5 Optional test over the real vault (skipped without it): AN1 gives 20 🟢 and 32 🟡

## 2. Engine core

- [ ] 2.1 `src/study-game/config.ts`: `GameConfig` and `DEFAULT_GAME_CONFIG` (K0, Kmin, p*, margin, XP, combo, boss multiplier, level thresholds, combo gap)
- [ ] 2.2 `src/study-game/model.ts`: `probability`, `logit`, `updateTheta` (throws on invalid r), with tests (σ(0) = 0.5, update sign and size)
- [ ] 2.3 `ExerciseAttemptInput` and `GameState` types

## 3. Replay

- [ ] 3.1 `src/study-game/replay.ts`: dedupe, order by (occurredAt, id), `supersedes` resolution (D12)
- [ ] 3.2 θ per section with cold start, section levels (D13, D15)
- [ ] 3.3 XP, combo and global level (D14)
- [ ] 3.4 Bosses (unlocked, beaten, note closed) and review queue (D13, D16)
- [ ] 3.5 Tests: shuffled history gives the same state, correction replaces the grade, XP monotone in r, combo, cold start, boss lock/beat, review queue

## 4. Next exercise and convergence

- [ ] 4.1 `src/study-game/next.ts`: `nextExercise` (D17)
- [ ] 4.2 Tests: no repeat of solved exercises, no locked bosses, `generate` when the catalog is exhausted
- [ ] 4.3 Seeded simulated-student convergence test (D18): 100 students, θ_true uniform in [−2, 2], ≥ 75 within 0.5, pooled success rate 0.8 ± 0.03, |mean bias| < 0.15

## 5. Wrap-up

- [ ] 5.1 Export everything from `src/index.ts`; `npm run test` and `npm run typecheck` in `packages/shared` green
- [ ] 5.2 Count the parsed exercises per vault note and record them, with the default parameters, in this file
