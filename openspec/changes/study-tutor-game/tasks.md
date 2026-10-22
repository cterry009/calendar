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

- [x] 8.1 Web: `exerciseAttempts?` in `SyncSnapshot`, offline entity type and conflict label, `logExerciseAttempt` in `lib/studyGame/` (D24)
- [x] 8.2 Mobile: `exerciseAttempts?` in the snapshot type and the pull/batch types
- [x] 8.3 Web and mobile typecheck; web tests

## 9. Phase 2: export and wrap-up

- [x] 9.1 `export-study-status.mjs`: game state per note in the markdown and the JSON (D25); dry run against the dev user
- [x] 9.2 Server tests and typecheck, shared tests and build green; record the results here

## Phase 2 results (2026-10-21)

- **Server:** migration `20261022015728_exercise_attempts` (additive: a table, two enums, two
  indexes). 79 tests (4 new: idempotent create with a racing duplicate, correction before its
  original, whole-history pull without texts or other users, DTO limits) and typecheck green.
- **Shared:** `ExerciseAttemptSchema`, 242 tests and typecheck green; a parsed attempt goes straight
  into `replay` (checked at compile time).
- **Web:** snapshot field, offline queue and `logExerciseAttempt`, which also queues a send that fails
  while online (a user's correction must not be lost). 85 tests and typecheck green. **Mobile:** types
  only, typecheck green.
- **End to end against the dev API** with a throwaway account (`tutor-phase2-*@local.test`, so the
  user's own history stays empty): 6 attempts applied, r = 0.7 rejected with 400, the pull has the 6
  without feedback, `GET /sync/exercise-attempts` has the feedback, and the export's dry run showed 5
  effective attempts (the correction replaced the failure), 28 XP, θ per section and 00b#2#1 in the
  review queue. The real export for dev@local.test now has the "Juego de ejercicios" section
  ("todavía no hay ejercicios intentados", 304 exercises in 26 notes) and `juego` in the JSON
  (version 2).
- Lint: the new files are clean; `apps/web` still reports two unused imports in
  `DesktopUsageWarnings.tsx` (untouched).

## 10. Phase 3: shared in the server

- [x] 10.1 `noteSections(markdown)` in `packages/shared/src/notes/exercises.ts`, with tests (D29)
- [x] 10.2 `"@calendar/shared": "file:../packages/shared"` in the server; `require` works in Nest and Vitest; CLAUDE.md and README updated (D26)

## 11. Phase 3: catalog and game on the server

- [x] 11.1 `server/src/tutor/catalog.ts`: vault notes parsed with `parseExercises` and `noteSections`, cached by mtime
- [x] 11.2 `tutor-game.service.ts`: the user's attempts replayed, the section state and `nextExercise`; `GET /tutor/state` (D34)

## 12. Phase 3: Claude

- [x] 12.1 `profesor.md` (Spanish): rubric for r, hints, LaTeX, read only the given range, never compute θ/XP
- [x] 12.2 `TutorModel` interface and `ClaudeCliTutor` (spawn without shell, JSON schema, session id / resume, timeout, errors → 503) (D27, D28, D33)
- [x] 12.3 Turn prompt builder: study session, θ, current exercise, note path and section range (D29)
- [x] 12.4 Reply validation (D31)

## 13. Phase 3: the turn

- [x] 13.1 `POST /tutor/turn`: pick or keep the exercise, run Claude, validate, record the attempt through the sync service, next exercise, game state (D30)
- [x] 13.2 Conversation ownership in memory, one turn per user (D32)
- [x] 13.3 `.env.example`: `TUTOR_MODEL`, `TUTOR_CLAUDE_BIN`, `TUTOR_TIMEOUT_MS`

## 14. Phase 3: tests and a live try

- [x] 14.1 Tests with a fake model on the test database: first turn, grading records an attempt and moves on, grade for another exercise → 502, generated exercise keeps the engine's b, unknown conversation → new one with a warning, 429, missing binary → 503, `GET /tutor/state`
- [x] 14.2 Live test (`TUTOR_LIVE=1`) and one real turn against the dev API with a throwaway account; record time and results here

## Phase 3 results (2026-10-21)

- **Server:** 90 tests (11 new for the tutor, with a fake Claude on the test database) and typecheck
  green; shared 245 tests (3 new for `noteSections`). The server loads the built `@calendar/shared`
  with `require`; shared's `exports` needed a `default` condition for that (it only had `import`).
- **Live test** (`TUTOR_LIVE=1 npx vitest run test/tutor.live.test.ts`): Opus graded a complete answer
  to AN1#1#1 with r = 1 in 9 s, attempt recorded (θ 0 → 0.22, 5 XP).
- **Real turns through the API** (throwaway account `tutor-phase3-*@local.test`, the real vault,
  AN1 §3): `GET /tutor/state` 62 ms. Turn 1 (7.9 s): the engine put the true/false AN1#3#9 on the table
  and Claude presented its six claims without revealing the answers. Turn 2 (12.9 s): five right and
  item 5 wrong (convergence vs absolute convergence); Claude spotted exactly that, gave the
  counterexample $(-1)^n/\sqrt n$, graded r = 0.5 with no hints; the attempt was stored with the
  feedback, θ went 0 → −0.25 (a V/F at b = −1.5 was expected to be fully right), +2 XP, and the
  engine moved on to 🟢 AN1#3#1.
- Not done: the study session in the prompt comes only from `studyTaskId` when the client sends it
  (the UI will, in phase 4), not from the schedule as `planning/study.ts` would infer it.
