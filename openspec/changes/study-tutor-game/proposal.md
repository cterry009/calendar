## Why

Study blocks (B1, B2, Pilar E) today end with "¿completaste la sesión?" and nothing about how well the
material went in. The notes in the vault already carry ~200 graded exercises (🟢/🟡, true/false, 🔴/⚫
closings) that the app ignores. The user wants a tutor inside the app that proposes those exercises at
the right difficulty (~80% success, Wilson et al. 2019) and turns progress into a game: XP, levels,
combos, bosses and review. The full design is in the vault (`Notas de Fisica/Tutor_diseno.md`,
decisions taken 2026-10-20); this change carries it through five phases, each reviewed before it is
applied.

## What Changes

The change is planned in five phases. **Only phase 1 is in this change's tasks**; phases 2-5 get their
own tasks (and prompts) when the previous one closes.

1. **Catalog + engine** (this change's tasks). Pure code in `packages/shared`, no I/O:
   - `parseExercises(fileName, markdown)` reads every exercise of a note into a stable catalog
     (`AN1#3#2`, `AN1#cierre-rojo#D2`) with its kind, starting difficulty b₀, statement, answer and hint.
   - `study-game/`: Rasch probability, Elo-style θ update per note section, `replay` of the attempt
     history into the whole game state (θ, levels, XP, combo, bosses, review queue), and
     `nextExercise`, which targets p* = 0.8 or asks for a generated exercise.
2. **Data**: synced entity `ExerciseAttempt`, immutable and idempotent like `FocusEvent`.
3. **Tutor**: `server/src/tutor/`, `POST /tutor/turn` running `claude -p` with the vault; the model
   grades and proposes, the code records and decides.
4. **UI**: Tutor panel on the pomodoro page during study blocks, exercise cards, XP/combo/level
   animations, boss bar, block summary in `BlockReview`, progress per section on the Dashboard.
5. **MCP** (optional): a small stdio server exposing the game to an external chat.

Also, once phase 2 exists, `scripts/export-study-status.mjs` adds the game state per note and section.

No breaking changes.

## Capabilities

### New Capabilities
- `exercise-catalog`: parsing the exercises written in the vault notes into a catalog with stable ids,
  kinds, starting difficulty, statement, answer and hint.
- `study-game-engine`: the adaptive model and game rules: probability, θ update, deterministic replay
  of attempts (corrections, cold start, XP, levels, combo, bosses, review queue) and next-exercise
  selection.

### Modified Capabilities
<!-- None in phase 1. Phases 2-4 will modify `cross-platform-sync` and `pomodoro-timer`. -->

## Impact

- Phase 1: new files `packages/shared/src/notes/exercises.ts`, `packages/shared/src/study-game/*`,
  their Jest tests, and exports in `packages/shared/src/index.ts`. No dependency added, no server,
  database, client or vault change. `import-study-notes.mjs` and `planning/study.ts` stay untouched.
- Later phases: Prisma schema + migration and sync (2), a server module that needs `claude` installed and
  logged in on the server's Windows (3), web UI (4).
