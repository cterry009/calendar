## Context

Since the timetable of 2026-10-19 every WORK block is a `Schedule` with a `category` and a pomodoro
`sequence`; a block occurrence runs one `PomodoroSession` with id `block-<scheduleId>-<YYYY-MM-DD>`
(`blockSessionId`), shared by the PC and the phone. Both clients **auto-start** that session when the
block's window opens (`SoftFocusContext.tsx`, mobile `useBlockFocus.ts`). In sequence mode the
segments are anchored to `blockStartAt` (`sessionSegments`, `segmentIndexAt`): the clock decides the
running segment, starting late joins it, and the session ends at `blockEndAt`.

Blocking: the web's `isFocusActive` (desktop hosts/process blocking through `DesktopBlockingBridge`)
and the phone's `useFocusBlocking` are on for the **whole WORK window**, plus a running FOCUS.

The tutor finds the block's study session from `session.scheduleId` + `session.taskId`
(`TutorPanel.tsx`), and the pill's "Tutor" button needs `studySectionsOf(task)`.

`MAX_BLOCK_REMINDERS` (3) exists in `planning/study.ts` but nothing uses it. The study status in the
vault is only written when `scripts/export-study-status.mjs` is run by hand.

Decisions taken by the user (2026-10-22): the pasted spec (`Prompt_bloques_dinamicos.md` in the
vault) and four answers in this session: at 12:00 the running focus finishes and the closing follows;
blocking only in focus and closing; the focus view lives inside the app window; the server writes the
study status by itself.

## Goals / Non-Goals

**Goals:**
- Morning study blocks that start on demand, sized by a check-in, counted by real focus.
- All the rules in pure, tested shared code; clients only render and send events.
- Nothing changes for afternoon and Saturday blocks, or for sessions created by older clients.

**Non-Goals:**
- Starting flexible blocks from the phone (it follows a block started on the PC).
- Phone reminders (the PC shows them; the phone keeps its ongoing notification).
- Calibrating the energy table from data (the check-ins are logged so it can be done later).
- Changing the night window, the wake-up exercise habit or the afternoon.

## Decisions

- **D1 The morning is a window on the existing schedule, not new schedules.** The morning WORK
  schedules (B1 Mon/Tue/Thu, B2 Wed, Pilar E Fri) become 08:00-12:00 and get
  `Schedule.flexibleBlocks = 2` (new nullable Int; null = a fixed block as today). Keeping the same
  schedule rows keeps their ids, categories, labels (`studyLinesForBlock` reads the label),
  exceptions and the history. *Alternative rejected:* two new schedules per day (B1a, B1b) — fixed
  times again, and twice the rows to keep in sync.

- **D2 Updating existing users in place.** `templateToSchedules` (fresh imports) emits the window with
  `flexibleBlocks: 2` and no sequence. For the existing schedules, a pure
  `morningWindowChanges(schedules, now)` returns update changes (by id) for WORK schedules whose
  category is a morning one and that aren't on Saturday: start 480, end 720, `flexibleBlocks: 2`,
  `sequence: null`. The web shows it once as "Actualizar la mañana (ventana 08:00-12:00)" on the plan
  page; it doesn't re-import the timetable (that deletes and recreates WORK blocks).
  `horario.ts` changes the five morning blocks to 08:00-12:00, adds `bloques_manana` (window, 2
  blocks, the energy table) and replaces `secuencias_pomodoro.manana` with a note pointing to it,
  dated 2026-10-22; its header says the morning was changed by the user after the JSON.

- **D3 Session per started block.** A flexible block's session id is
  `block-<scheduleId>-<YYYY-MM-DD>-<n>`, n = 1, 2, ... in start order that day
  (`flexibleBlockSessionId`). The PC and phone reading the same snapshot agree on n. The session
  keeps `scheduleId` and `taskId` (the line's current study session, as today), so `TutorPanel` and
  the pill's "Tutor" button work unchanged. A third block is allowed (the window aims for two; it
  doesn't forbid more).

- **D4 Flexible session fields.** `PomodoroSession` gets `flexible Boolean @default(false)`,
  `plannedBlockMin Int?`, `windowEndAt DateTime?`, `focusMinutes Int @default(0)`. A flexible session
  sets `blockStartAt` (its real start) and `sequence` (the planned segments) but **not**
  `blockEndAt`: old clients see no clock-anchored sequence and no fixed end, so they can't misplace it
  (they treat it as a plain session; acceptable until updated). `focusMinutes` is real focus done
  (focus segments only, cut ones by their worked minutes) and only goes up; the sync keeps the max,
  like `reviewedCycles` and `cutCount`.

- **D5 Relative sequence.** In a flexible session each segment runs from its own `startedAt` for its
  own minutes; nothing is computed from the clock. Pauses start automatically when a focus ends
  (`FOCUS_COMPLETE` → pause). When a pause's time is up, the state stays in the pause
  (`SHORT_BREAK`/`LONG_BREAK`) with `getPhaseDurationMinutes` reporting it; **no `BREAK_COMPLETE`
  moves it on**. A new event `START_FOCUS { minutes }` starts the next focus (or the closing) with the
  chosen minutes, written to `focusDurationMin`. Starting during a pause is allowed (pauses can be
  cut short by hand). Clock-anchored sessions are untouched.

- **D6 Planned sequence from the check-in.** `planFlexibleBlock(blockMin, focusMin)` returns
  focus/pause pairs and the closing: every focus is followed by its pause, 5 min after a focus under
  40 min and 10 min after a 40 min one; the closing is 15 min (the existing "Cierre" label). Full
  pairs are added while they fit with the closing; the last focus takes what's left (minus its
  pause), and is dropped if that's under 20. Focus labels reuse the morning's intent (P1 arranque,
  P2 profundo, ..., last one corto). Results for the table:
  90/20 → 20+5+20+5+20+5+15 (3 focos, 60 min de foco);
  120/30 → 30+5+30+5+30+5+15 (3 focos, 90 min);
  150/40 → 40+10+40+10+30+5+15 (3 focos, 110 min).
  The plan is a guide: since focus starts are manual, the real block can run longer than `blockMin`.

- **D7 Energy table.** In `plan/morning.ts`, like `attention/profiles.ts`:
  `energyOf(motivation, concentration) = round((m + c) / 2)` (halves round up: 2.5 → 3);
  E ≤ 2 → 90/20, E = 3 → 120/30, E ≥ 4 → 150/40. `clampBlockMin` 90-150 (steps of 15),
  `clampFocusMin` 20-40 (steps of 5). The model never decides minutes.

- **D8 Check-in logging.** Starting a flexible block logs a `CHECK_IN` focus event with
  `meta: { scope: 'block-start', motivation, concentration, energy, proposed: { blockMin, focusMin },
  chosen: { blockMin, focusMin }, blockNumber, device }`. No new entity. The existing per-pomodoro
  `CHECK_IN` (`scope: 'pomodoro'`) is unchanged.

- **D9 Next focus proposal.** `nextFocusProposal(session)`: the next focus of the plan. A cut caps
  every later focus of the plan at the worked minutes rounded down to 5 (never under 20), so the cap
  stays for the rest of the block; a focus the user lengthens by hand is written into the plan too. The
  user can move it 20-40 before starting. The proposal is shown on the pause screen with − / +.

- **D10 "Cortar tramo" in flexible blocks** ends the running focus, counts it (pomodoro + cut +
  worked minutes into `focusMinutes`) and starts its automatic pause. Offered whenever a focus runs.

- **D11 The 12:00 rule.** `windowEndAt` is the window's end that day. After it, `START_FOCUS` for a
  focus is refused; the closing can still start. When a focus ends after `windowEndAt` (or a pause is
  running at that time), the next segment offered is the closing, not a focus. A block not started by
  12:00 isn't prompted by reminders; one the user starts by hand after the window has no
  `windowEndAt` (starting it is the user's explicit choice; implemented 2026-10-22). The afternoon and lunch schedules don't move.

- **D12 Ending a flexible block.** The block ends when the closing ends, or when the plan has no
  segment left, or with "Terminar bloque" (a clean end, not "Salir"). The end-of-pomodoro rating card
  is unchanged; the "¿completaste la sesión?" question goes with the last focus or the closing.
  "Salir" keeps its meaning (pause the session, count an exit).

- **D13 Block and morning completion.** `blockDone(session) = focusMinutes ≥ 60`
  (`BLOCK_DONE_FOCUS_MIN`). `morningStatus(sessions, date)` counts that day's flexible sessions:
  `{ started, done, target: 2, fulfilled: done ≥ 2 }`. The day view shows the window with "Bloque
  1 ✓ 72 min de foco · Bloque 2 …" and "Mañana cumplida"; the dashboard shows mornings fulfilled this
  week and minutes of focus per block.

- **D14 Blocking.** A flexible schedule's window is not "work hours": `activeWorkSchedule` gains an
  option to skip flexible schedules for blocking purposes, so the soft focus overlay, desktop blocking
  and the phone's `useFocusBlocking` only block during a flexible session's work segments (focus and
  closing), through the existing `isBlockingPhase`. The closing counts as work (as today). Afternoon
  and Saturday blocks still block their whole window.

- **D15 Reminders.** Pure `dueMorningReminder({ now, window, sessions, sent })` returns the reminder
  to show, or none: `start` at 08:20 and again at 08:50 when no block has started; `between` 20 min
  after block 1 ended when block 2 hasn't started; none after `windowEndAt` or once the morning is
  fulfilled; at most `MAX_BLOCK_REMINDERS` (3) per morning. `sent` lives in localStorage per day on
  the PC. Shown as a desktop notification (`lib/desktop/notify.ts`) plus an in-app toast with
  "Empezar bloque". The pause overrun notice (one per pause, at the pause's end) is separate and
  doesn't count toward the cap.

- **D16 Starting a block (UI).** On the morning window (day view, plan, pomodoro page and the focus
  view's idle state) a "Empezar bloque N" button opens the check-in card: two rows of 1-5, the
  proposal (block and focus minutes) with − / +, the study session it will work on, "Empezar". It
  starts the first focus right away. Before 08:00 or after 12:00 the button is still there (the
  timetable is a recommendation), with the 12:00 rule after 12:00.

- **D17 Focus view.** While a pomodoro is active (any pomodoro, block or not), the app's layout
  renders `FocusView` instead of the navigation and the page: big timer, segment label, block plan
  progress, the pause screen with the next-focus control, "Cortar tramo", "Terminar bloque",
  "Salir", and for study blocks the `TutorPanel` beside the timer (below on narrow windows). A
  "Ver la app" button collapses it back to the existing pill for the rest of that phase; the next
  phase brings the view back. Inside the app window only: nothing goes over other apps, and
  the window isn't forced to the front (2026-10-06 rule). `BlockFocusOverlay`'s pill stays for the
  collapsed state and for the "Salir" flow.

- **D18 Study status auto-export.** The status builder moves from `scripts/export-study-status.mjs`
  into `packages/shared/src/study-status/` (pure: snapshot + focus events + catalog → markdown and
  JSON, plus the "Notas" merge). A server `StudyStatusService` listens to applied sync batches that
  touch tasks, exercise attempts, focus events or pomodoro sessions, debounces 30 s per user, and
  writes both files into `CALENDAR_VAULT` for the user whose email is `STUDY_STATUS_EMAIL` (the
  dev user; unset = off, so test accounts never write the vault). Writes go to a temp file and are
  renamed. The script keeps working and uses the same builder.

- **D19 Phone, minimal.** Mobile gets the new fields in its types, skips auto-start for flexible
  schedules, uses D14 for blocking, and shows a flexible session started on the PC (timer, segment,
  "Salir"). Its sequence code treats a flexible session as relative (D5) so the timer is right.
  No check-in, no "start focus" on the phone in this change (open question 1).

## Risks / Trade-offs

- **Old clients and flexible sessions** → they ignore `flexible` and may cycle the session like a
  plain pomodoro (auto-start focus after the break). Mitigation: no `blockEndAt` on flexible
  sessions; update the desktop and the phone with this change.
- **Two sessions on the same schedule per day** → code that assumes one session per
  `(scheduleId, day)` (`weekProgress`, the dashboard, the study status) is reviewed; they already sum
  sessions, the ids are the only assumption (`blockSessionId` call sites).
- **A pause left open forever** → the existing abandoned-phase rule (15 min grace) would end it.
  For flexible pauses the grace is 60 min after the pause's planned end; then the block ends cleanly
  (not interrupted), with whatever focus it has.
- **Vault writes from the server** → only for one configured email, atomic writes, and the Notes
  section kept; a failure only logs.

## Migration Plan

1. Prisma migration adds the five nullable/defaulted fields; old rows are fixed blocks and plain
   sessions.
2. Deploy server, then web/desktop (new installer), then phone.
3. The user taps "Actualizar la mañana" once (D2); before that, the morning stays as it is.
Rollback: the fields are additive; setting `flexibleBlocks` back to null and the old times restores
the fixed block.

## Open Questions

Approved 2026-10-22 without answers to these, so the proposed defaults apply:

1. **Phone:** starting flexible blocks from the phone is a later change.
2. **Reminder times:** 08:20 and 08:50 for the first block, 20 min after block 1 for the second.
3. **Wake-up exercise:** unchanged.
4. **Vault `Horario.md`:** not touched (the user's file); only `horario.ts` changes.
5. **Third block:** allowed when two are done before 12:00.
