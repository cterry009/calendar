# Design

## Context

`apps/web` is also the desktop UI (Tauri loads it). Themes come from `packages/ui/src/tokens.ts`; the
Agenda palettes exist as `agendaLight`/`agendaDark` (2026-11-08). The tutor runs `claude -p` from
`server/src/tutor/tutor-model.ts` and answers when it finishes. Real-time updates already ride the
`/sync` Socket.IO namespace.

## Decisions

1. **Default theme, not a fork:** switch the default in `AppearanceContext` to the Agenda mode that
   matches the OS (light/dark) for users with no stored choice; nothing is removed.
2. **Hoy first:** a new `HoyPage` becomes `/`; existing pages stay reachable; components reuse the
   current hooks (`useSchedules`, `usePlan`, `useTasks`, habits) — redesign, not new data.
3. **Full screen:** a `FullscreenLayout` route (`/enfoque`) with no navigation chrome; the desktop app
   toggles native full screen (Tauri window API) with F11 and `--fullscreen`. Arrow keys / Enter move
   between tiles; gamepad via the browser Gamepad API where available.
4. **Reasoning progress:** `claude -p --output-format stream-json` in the tutor; the server maps
   events (tool calls such as Read of a note, text deltas, thinking summaries when present) to short
   Spanish steps and forwards them to the requesting device on Socket.IO (`tutor:progress`); the full
   reasoning is never shown. The client shows "Pensando… N s" from its own clock. **Estimate:** the
   server keeps each turn's `durationMs` (already measured in `tutor-model.ts`) and returns the median
   of the user's last 20 turns of the same kind (grade / hint / new exercise) with the turn; under 3
   samples, no estimate is shown. The final grade path is unchanged.
5. **Hidden clock:** a per-device preference; segment changes still notify; the session record is the
   same. Per-session progress is computed from `PomodoroSession`, `FocusEvent` and `ExerciseAttempt`
   rows already synced (shared function, tested).
   **Bar to the next section:** reuses the game's replayed state (`study-game/`): the bar is the
   section's level progress toward `MASTERED_SECTION_LEVEL`; the next section unlocks when the level is
   reached and at least `MIN_EXERCISES_TO_ADVANCE` (5) attempts were made in it, and
   `firstUnmasteredSection` already makes the next block start there. Nothing new is stored.
6. **Sync status:** derived from the offline queue (`SyncContext`): queued count, last success, socket
   state.

## Risks / Trade-offs

- [Streaming adds server complexity] → progress events are best-effort; if lost, the final answer
  still arrives as today.
- [A redesign while another agent edits apps/web] → work page by page, in this change's task order,
  after checking `git status`.
