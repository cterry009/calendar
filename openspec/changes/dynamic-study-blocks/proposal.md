## Why

The morning study block is rigid: 09:30-12:30 on the clock, its sequence anchored to the scheduled
start (starting at 10:10 joins whatever segment is running and loses the earlier ones), and it always
ends at 12:30. The user wants the timetable to be a recommendation: a morning window in which two
study blocks start when the user starts them, last as long as their energy that day allows, and are
counted by the focus actually done, not by reaching an end time (decisions of 2026-10-22, in the vault
as `Prompt_bloques_dinamicos.md`).

## What Changes

- **Morning window 08:00-12:00** (Monday-Friday) replaces the fixed 09:30-12:30 block. Inside it the
  user aims for **two study blocks** of the day's line (B1, B2 or Pilar E). `horario.ts` is updated
  with this decision (2026-10-22); the schedule is shown as a window with two suggested blocks.
- **Blocks start when the user starts them.** No auto-start for these blocks (web/desktop and phone
  auto-start WORK blocks today). The block's sequence is anchored to the real start, so starting late
  loses nothing.
- **Energy check-in at block start:** motivation and concentration, 1-5 each. A fixed table in shared
  code turns them into a proposed block length (90/120/150 min) and focus length (20/30/40 min); the
  user can adjust both before starting. The check-in is logged as a `CHECK_IN` focus event for later
  calibration.
- **Before each focus** the app proposes its length (the check-in's, shortened after a "cortar
  tramo") and the user can move it between 20 and 40.
- **Automatic pause, manual focus.** A focus ending starts its pause by itself; the next focus only
  starts when the user starts it. A pause that runs over gets one soft notice.
- **At 12:00** no new focus starts: the focus already running finishes and the block goes to its
  15-minute closing. The afternoon and lunch never move.
- **Soft reminders** wired for the first time to `MAX_BLOCK_REMINDERS` (defined, never used): no
  block started some time after 08:00, and a long gap between the two blocks. At most 3 per morning.
- **Block done = at least 60 minutes of real focus**; the morning is done with two done blocks. Shown
  on the day view and on the dashboard.
- **App and site blocking follows the block:** on during focus and closing segments of a started
  block, off in pauses and between blocks (today it covers the whole WORK window).
- **Focus view:** while a pomodoro runs, the app window shows only the pomodoro (timer, segment,
  next-focus control, "Salir", "Cortar tramo", and the tutor for study blocks) instead of the
  navigation and a page. Nothing goes over other apps (rule of 2026-10-06 stays).
- **Study status written by itself:** the server regenerates `Estado_estudio.md` / `estado_estudio.json`
  in the vault a few seconds after study data changes, with the same content as
  `scripts/export-study-status.mjs` (which stays as the manual way) and keeping the hand-written
  "Notas" section.
- Unchanged on purpose: afternoon blocks (14:00-15:25, 15:35-17:00) and Saturday keep their fixed,
  clock-anchored sequences; the tutor keeps finding the block's study session; "cortar tramo" now
  just ends the focus and starts the automatic pause.

No breaking changes for the API: new nullable fields on `Schedule` and `PomodoroSession`, defaulted on
old clients. Sessions created by older clients keep the current behaviour.

## Capabilities

### New Capabilities
- `flexible-morning-blocks`: the morning window, blocks started on demand (two per morning, own
  session ids), relative sequence with automatic pause and manual focus, the 12:00 rule, blocking
  only during work segments, block and morning completion, reminders, and the schedule data change.
- `energy-check-in`: the motivation/concentration check-in, the energy table (block and focus
  lengths, pauses), manual adjustment, per-focus proposal after cuts, and logging for calibration.
- `focus-view`: the full-window pomodoro view in web/desktop while a pomodoro runs.
- `study-status-autoexport`: the server writing the vault's study status files after study changes.

### Modified Capabilities
<!-- None: openspec/specs/ doesn't exist yet. -->

## Impact

- `packages/shared`: `plan/horario.ts`, `plan/plan.ts`, `plan/sequence.ts`,
  `pomodoro/state-machine.ts`, `attention/focus-status.ts`, `planning/study.ts`, new
  `plan/morning.ts` (energy table, window, completion, reminders), `schemas/` (session and schedule
  fields), study-status builder moved out of the script.
- `server`: Prisma migration (`Schedule.flexibleBlocks`, `PomodoroSession.flexible`,
  `plannedBlockMin`, `windowEndAt`, `focusMinutes`), sync types/DTO/service/tests, new
  `study-status` module writing the vault.
- `apps/web` (and the desktop through it): block start with check-in, focus view, next-focus control,
  reminders, blocking rule, day and dashboard completion, timetable update for existing users.
- `apps/mobile`: snapshot/session types, no auto-start for flexible blocks, follows a block started on
  the PC (status and blocking); starting flexible blocks from the phone is out of scope.
- `apps/desktop`: no Rust changes expected (blocking already follows the web's focus state).
