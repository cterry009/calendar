# Proposal

## Why

On 2026-11-09 the user ended a study block a few minutes in and asked that this not be possible: a
pomodoro (a single focus segment) should only end once most of it is done — before that it can only be
paused — and when one ends the app should suggest the next pomodoro, what to do in it, and how long it
should be given his concentration and motivation. Each session should count its pomodoros and its
progress in topics. This holds for every kind of block: study, research, paper and work.

## What Changes

1. **Ending needs 75 % of the focus.** "Terminar pomodoro" / "Cortar tramo" and ending the block are
   disabled until the running focus has reached 75 % of its planned minutes (a constant in shared code,
   between the 70 and 80 % the user named); before that the only action is "Pausar". A paused focus
   keeps its progress. Closing segments and pauses are not affected.
2. **Next pomodoro suggested** when a focus ends: its length (the existing diagnosis/rating rules of
   `bloques_dinamicos`), and what to do — the block's category labels (`pomodoros_sugeridos`), the
   study pensum's next section (study blocks, with the tutor), the project's next step (research/paper
   blocks, once projects exist) or the next task (work blocks).
3. **Per-session counters** for every block kind: pomodoros completed, focus minutes, and topic
   progress — sections advanced for study, next steps or log entries for research/paper, tasks done for
   work — shown during the session and in its summary.

## Capabilities

### New Capabilities
- `focus-session-flow`: the 75 % rule, pause-only before it, the next-pomodoro suggestion, and the
  per-session counters for all block kinds.

### Modified Capabilities
<!-- none: openspec/specs/ is empty -->

## Impact

- `packages/shared/src/pomodoro/` (state machine guard, suggestion function) + tests;
  `apps/web` and `apps/mobile` pomodoro controls and the session summary (agenda-redesign look);
  the native focus overlay if it offers an end action. No data model change: counters come from
  `PomodoroSession`, `FocusEvent`, `ExerciseAttempt` and (later) project log entries.
