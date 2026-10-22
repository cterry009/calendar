Phase 1 (catalog + engine in `packages/shared`): groups 1-5, done. Phase 2 (data and sync): groups
6-9, at the end. Phases 3-5 (tutor, UI, MCP) get their tasks when the previous phase closes; see
proposal.md.

## 1. Exercise catalog

- [x] 1.1 `src/notes/exercises.ts`: `Exercise` type and `parseExercises(fileName, markdown)` for 🟢/🟡 exercises in `## N.` sections and `### N.` sections under `## Desarrollo`, with statement/answer separation (D7, D8, D10)
- [x] 1.2 True/false callouts as one `vf` exercise each, claims without verdicts as statement (D9)
- [x] 1.3 🔴/⚫ closings: `D1`/`M1` labels, optional title, hint and solution
- [x] 1.4 Jest tests with short fixtures copied from the real format (ids, b₀, LaTeX intact, answer and hint apart, sections under Desarrollo, re-parse equality)
- [x] 1.5 Optional test over the real vault (skipped without it): AN1 gives 20 🟢 and 32 🟡

## 2. Engine core

- [x] 2.1 `src/study-game/config.ts`: `GameConfig` and `DEFAULT_GAME_CONFIG` (K0, Kmin, p*, margin, XP, combo, boss multiplier, level thresholds, combo gap)
- [x] 2.2 `src/study-game/model.ts`: `probability`, `logit`, `updateTheta` (throws on invalid r), with tests (σ(0) = 0.5, update sign and size)
- [x] 2.3 `ExerciseAttemptInput` and `GameState` types

## 3. Replay

- [x] 3.1 `src/study-game/replay.ts`: dedupe, order by (occurredAt, id), `supersedes` resolution (D12)
- [x] 3.2 θ per section with cold start, section levels (D13, D15)
- [x] 3.3 XP, combo and global level (D14)
- [x] 3.4 Bosses (unlocked, beaten, note closed) and review queue (D13, D16)
- [x] 3.5 Tests: shuffled history gives the same state, correction replaces the grade, XP monotone in r, combo, cold start, boss lock/beat, review queue

## 4. Next exercise and convergence

- [x] 4.1 `src/study-game/next.ts`: `nextExercise` (D17)
- [x] 4.2 Tests: no repeat of solved exercises, no locked bosses, `generate` when the catalog is exhausted
- [x] 4.3 Seeded simulated-student convergence test (D18): 100 students, θ_true uniform in [−2, 2], ≥ 75 within 0.5, pooled success rate 0.8 ± 0.03, |mean bias| < 0.15

## 5. Wrap-up

- [x] 5.1 Export everything from `src/index.ts`; `npm run test` and `npm run typecheck` in `packages/shared` green
- [x] 5.2 Count the parsed exercises per vault note and record them, with the default parameters, in this file

## Phase 1 results (2026-10-21)

**Catalog over the vault: 304 exercises in 26 notes.** Every 🟢/🟡/true-false marker and every
closing item was parsed (marker counts match), every exercise has an answer, and every closing has a
hint. 01, 02 and 03 have no exercises yet.

| Note | 🟢 | 🟡 | V/F | 🔴 | ⚫ | Total |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| AN1 | 20 | 32 | 10 | 4 | 3 | 69 |
| AN1b | 5 | 6 | 1 | 2 | 2 | 16 |
| AN1c | 3 | 2 | 0 | 0 | 2 | 7 |
| AN2 | 8 | 8 | 0 | 2 | 2 | 20 |
| AN3 | 7 | 7 | 0 | 2 | 2 | 18 |
| AN4 | 8 | 8 | 0 | 2 | 2 | 20 |
| 00b | 11 | 10 | 0 | 2 | 2 | 25 |
| 01a | 12 | 12 | 0 | 3 | 3 | 30 |
| E1 | 2 | 2 | 0 | 2 | 1 | 7 |
| E2 | 2 | 1 | 0 | 2 | 2 | 7 |
| A1, A2, A4 | 2 each | 2 each | 0 | 1 each | 1 each | 6 each |
| A3 | 1 | 1 | 0 | 1 | 1 | 4 |
| A5 | 1 | 2 | 0 | 1 | 1 | 5 |
| B1, B2, B4 | 3 / 2 / 2 | 1 / 2 / 2 | 0 | 1 each | 1 each | 6 each |
| B3 | 1 | 3 | 0 | 1 | 1 | 6 |
| C1 | 2 | 2 | 0 | 1 | 1 | 6 |
| C2 | 2 | 1 | 0 | 1 | 1 | 5 |
| C3 | 1 | 1 | 0 | 1 | 1 | 4 |
| D1 | 2 | 2 | 0 | 1 | 1 | 6 |
| D2 | 2 | 1 | 0 | 1 | 1 | 5 |
| D3, D4 | 1 each | 1 each | 0 | 1 each | 1 each | 4 each |

The pillar notes (A-D, B1, D1) only count because of D7 (`### N.` under `## Desarrollo`).

**Defaults (`DEFAULT_GAME_CONFIG`):** K0 0.8, Kmin 0.15, p* 0.8, margin 0.75; XP 10 · r · 2^(b − θ)
within 1-100, combo +0.1 per success in a row up to ×1.5, reset after 90 min, boss ×3; global level n
at 100 · n^1.5 XP; boss unlock at p ≥ 0.5; section levels from θ −1 / 0 / 1 / 2.

**Convergence (seed 20261021, 100 students, 60 attempts):** 80 of 100 within 0.5 of the true θ,
pooled success rate 0.7998, mean bias −0.085.

**Checks:** shared 239 tests and typecheck green. `npm run lint` still reports two errors in
untouched files (`notes/pensum.test.ts`, `plan/sequence.ts`); the new files are clean.

## 6. Phase 2: entity and server sync

- [x] 6.1 `schema.prisma`: `ExerciseAttempt` with enums `ExerciseSource` / `ExerciseGrader`, and the migration (D19)
- [x] 6.2 `sync.types.ts` + `dto/sync-batch.dto.ts`: `exerciseAttempts` with its validation (D22)
- [x] 6.3 `sync.service.ts`: `applyExerciseAttemptChange` (idempotent create, P2002 skipped, D20) and the attempts in the pull without texts (D21)
- [x] 6.4 `GET /sync/exercise-attempts?since=` (controller + service)
- [x] 6.5 Server tests: retry skipped, correction as a new row, correction before its original, pull with old attempts and no texts and no other user's, the full endpoint with `since`, DTO rejects r = 0.7 and b = 7

## 7. Phase 2: shared schema

- [x] 7.1 `packages/shared/src/schemas/exercise-attempt.ts`: `ExerciseAttemptSchema`, exported, its type usable as `replay` input (D23); test

## 8. Phase 2: clients

- [ ] 8.1 Web: `exerciseAttempts?` in `SyncSnapshot`, offline entity type and conflict label, `logExerciseAttempt` in `lib/studyGame/` (D24)
- [ ] 8.2 Mobile: `exerciseAttempts?` in the snapshot type and the pull/batch types
- [ ] 8.3 Web and mobile typecheck; web tests

## 9. Phase 2: export and wrap-up

- [ ] 9.1 `export-study-status.mjs`: game state per note in the markdown and the JSON (D25); dry run against the dev user
- [ ] 9.2 Server tests and typecheck, shared tests and build green; record the results here
