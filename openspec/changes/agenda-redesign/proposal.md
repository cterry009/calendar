# Proposal

## Why

The user prefers the look of the "Agenda" board prototyped in a Claude artifact (2026-11-08) and asked
on 2026-11-09 for less friction with the user, a full-screen mode in the style of Steam's Big Picture,
seeing the tutor's reasoning as it progresses, and a study section where the clock can be hidden and
each session shows its own progress — with the timetable organized and in sync with the app. Web and
desktop share `apps/web`, so one redesign covers both; the phone follows with the same tokens.

## What Changes

1. **Agenda look by default** on web/desktop (the opt-in "Agenda claro/oscuro" modes become the
   default; "Emerald" stays selectable). Tokens in `packages/ui`.
2. **Less friction:** *Hoy* is the home screen: the current block with one primary action (start /
   continue), what's next, today's tasks and habits; any routine action is at most two clicks away.
3. **Full-screen mode** ("Modo pantalla completa", Big Picture-like): F11 / a button / a launch flag
   on the desktop app; big tiles for the current block, the timer, the next block and the study
   session; keyboard (and gamepad, if Tauri exposes it) navigation; Esc leaves.
4. **Reasoning progress (tutor first, 2026-11-09):** while the tutor answers, a "Pensando… 12 s"
   line with a live counter and short summarized details of what it is doing, like Claude's own
   chat ("leyendo la nota 01a", "revisando tu paso 2", "calificando") — not the full reasoning —
   plus an **estimate** of how long it usually takes ("suele tardar ~25 s"), from the durations of
   the user's past turns. The planner's proposal gets the same display afterwards.
5. **Study section:** a "Ocultar tiempo" switch (the session still times and records; only the clock
   is hidden, with a soft notice when the block ends), **progress per session** (focus minutes,
   exercises done and right, level change per section, the session's check-ins and ratings), and a
   **progress bar to the next section**: it fills with the section's level toward mastery and, past
   its threshold (and a minimum number of exercises), the next section of the pensum unlocks and the
   next study block starts there.
6. **Timetable organized and in sync:** the Horario page as a week grid of what each block is, with the
   pending updates (like "Actualizar las tardes") as one review-and-apply step and a visible sync
   status ("guardado en el servidor", "pendiente", "sin conexión").

## Capabilities

### New Capabilities
- `agenda-ui`: the default look, the Hoy home, full-screen mode, reasoning progress, the study
  section's hidden clock and per-session progress, and the timetable view with its sync status.

### Modified Capabilities
<!-- none: openspec/specs/ is empty -->

## Impact

- `packages/ui` (tokens, default theme), `apps/web` (Hoy, Horario, study/tutor screens, full-screen
  layout, sync status), `apps/desktop` (full-screen flag and shortcut), `server/src/tutor` (streamed
  progress events over the existing Socket.IO gateway or SSE), `apps/mobile` later with the tokens.
