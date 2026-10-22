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

## Calibration data from the chat (2026-10-22)

Before the app was ready the user studied with Claude in a chat (vault:
`progreso_chat_2026-10-21_22.json`). `scripts/import-chat-attempts.mjs` brings its 30 graded exercises
in as ExerciseAttempts and the session of the 22nd as `CHECK_IN` focus events, where D8 keeps the
check-ins, with their own scopes (`chat-diagnosis`, `chat-pomodoro-rating`, `chat-pause`,
`chat-block`; `source: 'chat'`, `scale: '0-100'`) so they never mix with the app's 1-5 values:

- Block 1, 09:24-11:11 local, 50 min of focus, counted as done in the chat.
- Pomodoro 1: diagnosis 90/80 (first given as 5 and 4 on 1-5), 40 min of focus, final rating
  55/100 ("se paró varias veces, tomó un tinto").
- Pause: planned 10, real 29. The one soft notice at the pause's end (D5) is what was missing.
- Pomodoro 2: diagnosis 35/25, planned 20, closed at 10 min from tiredness. Closing a block early
  without penalty is `END_BLOCK` ("Terminar bloque", D12): it counts the focus done, and the block is
  done if that reached the minimum.
- The user asked in the chat for a 0-100 diagnosis scale; this change uses 1-5 (pending question,
  2026-10-22).

## Open Questions

Approved 2026-10-22 without answers to these, so the proposed defaults apply:

1. **Phone:** starting flexible blocks from the phone is a later change.
2. **Reminder times:** 08:20 and 08:50 for the first block, 20 min after block 1 for the second.
3. **Wake-up exercise:** unchanged.
4. **Vault `Horario.md`:** not touched (the user's file); only `horario.ts` changes.
5. **Third block:** allowed when two are done before 12:00.

## Revision 2 (2026-10-22, afternoon)

The user chose the vault's "versión 2" with a 0-100 diagnosis (proposal, "Revision 2"). The engine of
revision 1 stays (flexible sessions, relative segments, automatic pause and manual focus, `START_FOCUS`,
`END_BLOCK`, the 12:00-style closing rule, blocking, focus view, study status); these decisions replace
D1, D2, D6, D7, D9, D13 and D15, and extend D8 and D11.

- **D20 One schedule per suggested block.** Each weekday suggestion is its own flexible Schedule at its
  suggested time, `flexibleBlocks = 1`: B1 on Mon/Tue/Thu is two schedules, 09:00-10:30 and
  11:00-12:30, same label and category (so `studyLinesForBlock`, the tutor and the pill work as now);
  the afternoon keeps its two schedules per day, moved to 14:00-15:30 and 16:00-17:30. Session ids stay
  `block-<scheduleId>-<date>-<n>`; n is 1 unless the same suggestion is started twice that day.
  *Rejected:* one schedule per window with N blocks (revision 1's model) -- the afternoon's two blocks
  have different categories, and a reminder per suggestion needs a time per suggestion.
- **D21 Windows in the timetable.** `horario.ts` gets `ventanas_lun_vie`: mañana 09:00-13:00, tarde
  14:00-18:00. A session's `windowEndAt` is the end of the window that contains its schedule's start;
  a block started outside any window has none (as in D11). Lunch is 13:00-14:00; the 15:25-15:35 break
  goes away (pauses live inside blocks). `EXCLUDED_WORK_WINDOWS` (focusPlan.ts) moves to 13:00-14:00;
  the planner and free slots read the schedules, so they follow; the night window doesn't change.
- **D22 Diagnosis 0-100.** Motivation and concentration as two sliders, 0-100 in steps of 5, starting
  at the day's last values. Band of the average: **low < 45, medium 45-69, high ≥ 70** (the chat's 85
  is high, 30 is low).
- **D23 Lengths from the bands.** The first diagnosis sets the planned block: low 60, medium 90, high
  120. Each diagnosis sets its focus: low 20, medium 30, high 40; pause 5 after 20-30 and 10 after 40;
  the closing stays 15. Every proposal can be moved by hand (block 60-120 in steps of 10, focus 20-40 in
  steps of 5).
- **D24 The ±10 rule.** When the next focus starts (that's when its diagnosis is given) the planned
  block moves: **+10** if the last pomodoro's rating is ≥ 4 and the new band is high; **−10** if the
  rating is ≤ 2, the new band is low, or the last focus was cut ("cortar tramo" counts as low energy);
  otherwise 0. Always within 60-120 and never under the minutes already worked in the block (rounded
  up to 10). A dismissed rating card counts as no rating (only the diagnosis decides). The chat's block:
  85 → 120 planned, focus 40; rating 55/100 (≈ 3) and then 30 → −10 → 110, focus 20.
- **D25 The plan is a budget.** Instead of a precomputed list (D6), the session keeps `plannedBlockMin`
  and its sequence grows as it goes: each `START_FOCUS` appends the focus with its minutes and its
  pause. The closing is offered when the next focus (at least 20) plus its pause plus the closing no
  longer fits the planned block, or the window closed; "Terminar bloque" any time (D12). The focus view
  shows the planned block, the minutes worked and what's left.
- **D26 What's logged.** Every diagnosis is a `CHECK_IN` with `scope: 'pomodoro-diagnosis'`,
  `scale: '0-100'`, motivation, concentration, band, proposed and chosen focus, planned block before
  and after the rule, and the cycle; the first one of a block also carries the proposed and chosen
  block (`scope: 'block-start'`, as D8). The rating card stays as it is (1-5, `scope: 'pomodoro'`).
  The chat's imported events (`chat-*` scopes) sit beside them for calibration.
- **D27 Done with 45.** `BLOCK_DONE_FOCUS_MIN = 45`. The day's minimum is two done blocks from the
  morning window's schedules ("mañana cumplida"); the afternoon shows its blocks without a minimum.
- **D28 Reminders at the suggested times.** At each suggestion's start (09:00, 11:00, 14:00, 16:00),
  if no block is running and that suggestion hasn't been started today: one reminder, id = the
  schedule, never repeated, never after its window's end. `MAX_BLOCK_REMINDERS` (3) caps them per window
  start + returns as today; with one per suggestion it never binds.
- **D29 Labels.** Morning focuses keep revision 1's labels (P1 arranque, profundo, corto); afternoon
  focuses take the category's suggested pomodoros in order (`pomodoros_sugeridos`), as the clock
  sequences did.
- **D30 Updating an existing timetable.** "Actualizar la jornada" replaces "Actualizar la mañana":
  `weekdayV2Changes(schedules)` updates each morning schedule in place to the first suggestion and
  creates its second one, moves the afternoon schedules, moves lunch and deletes the 15:25 break --
  all in one batch, keeping every existing id. Revision 1's flexible sessions (only test accounts have
  them) end as they are.

### Answers (revision 2, 2026-10-22)

1. **Rating card on 0-100** too, same bands as the diagnosis: the rule reads a rating of 70 or more as
   high and under 45 as low (D24). Old 1-5 ratings are read as (r − 1) × 25 wherever they are averaged.
2. **Bands** low < 45, medium 45-69, high ≥ 70: confirmed.
3. **The phone starts blocks** in this revision: a suggested block with its diagnosis, the next focus
   after its diagnosis, the 0-100 rating, "Terminar bloque"; and the app is rebuilt and installed on the
   phone.
