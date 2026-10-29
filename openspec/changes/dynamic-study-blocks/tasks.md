## 1. Shared: rules (pure, with Jest)

- [x] 1.1 `plan/morning.ts`: `energyOf`, the energy table, `clampBlockMin` / `clampFocusMin`, `planFlexibleBlock` (D6, D7); tests: E = 2 → 90/20, E = 5 → 150/40, 2.5 → 3, the three plans of D6, a 135/30 plan
- [x] 1.2 `nextFocusProposal` after cuts (D9); tests: no cut, cut at 27 of 40 → 25, cut at 12 → 20
- [x] 1.3 `blockDone`, `morningStatus` (D13); tests: 60 min done, 30 min not, two done → fulfilled
- [x] 1.4 `dueMorningReminder` (D15); tests: 08:20 and 08:50 start reminders, between blocks, none after 12:00 or once fulfilled, cap of `MAX_BLOCK_REMINDERS`
- [x] 1.5 `horario.ts` (morning 08:00-12:00, `bloques_manana`, header dated 2026-10-22), `templateToSchedules` with `flexibleBlocks`, `morningWindowChanges` (D1, D2); tests: template and in-place update leave afternoon/Saturday alone
- [x] 1.6 Schemas: `Schedule.flexibleBlocks`, session `flexible`, `plannedBlockMin`, `windowEndAt`, `focusMinutes`

## 2. Shared: the state machine

- [x] 2.1 `createFlexibleBlockSession`, `flexibleBlockSessionId` (D3, D4)
- [x] 2.2 Relative sequence: `FOCUS_COMPLETE` → automatic pause, no `BREAK_COMPLETE` advance, `START_FOCUS { minutes }`, `focusMinutes` accounting, end after the closing or with "Terminar bloque" (D5, D12)
- [x] 2.3 Cut in flexible blocks (D10) and the 12:00 rule (D11); abandoned-pause grace (Risks)
- [x] 2.4 Tests: starting at 10:10 loses no segment; the pause starts by itself and the focus doesn't; a manual 40 is respected; at 12:00 the closing follows; clock-anchored sessions (afternoon) unchanged
- [x] 2.5 Blocking and status: `activeWorkSchedule` skips flexible windows for blocking (D14); `currentFocusStatus` for flexible sessions (pause over, next focus); tests

## 3. Server

- [x] 3.1 Prisma migration for the five fields; sync types, DTO, pull and apply (`focusMinutes` max); `test/sync.service.test.ts`
- [x] 3.2 Study status builder moved to `packages/shared/src/study-status/`; the script uses it (D18)
- [x] 3.3 `StudyStatusService`: debounce per user, `STUDY_STATUS_EMAIL`, atomic writes, Notes kept; tests with a temp vault

## 4. Web and desktop

- [x] 4.1 Types and offline defaults for the new fields; no auto-start for flexible schedules (`SoftFocusContext`)
- [x] 4.2 `PomodoroContext`: `startFlexibleBlock`, `startFocus(minutes)`, `endBlock`; the timer doesn't fire `BREAK_COMPLETE` for flexible pauses; pause-over notice
- [x] 4.3 Check-in card and "Empezar bloque N" on the day view, plan and pomodoro page (D16); `CHECK_IN` log (D8)
- [x] 4.4 `FocusView` in the layout: timer, plan progress, pause screen with the next-focus control, cut, end, "Salir", tutor; "Ver la app" (D17)
- [x] 4.5 Blocking: soft focus and desktop blocking follow D14
- [x] 4.6 Reminders on the PC (D15)
- [x] 4.7 Completion in the day view and the dashboard (D13)
- [x] 4.8 "Actualizar la mañana" on the plan page (D2)
- [x] 4.9 Vitest for the new web helpers; typecheck, tests, build

## 5. Phone (minimal)

- [x] 5.1 Types and snapshot defaults; no auto-start for flexible schedules; blocking per D14
- [x] 5.2 A flexible session started on the PC shows the right timer and segment (relative sequence); typecheck

## 6. Checks and a real try

- [x] 6.1 shared, web, server tests and typechecks; desktop installer
- [x] 6.2 Real try on the dev API with the dev user: apply the morning update, start a block with a check-in, a focus, the automatic pause, a manual focus, a cut, the tutor button; the vault's `Estado_estudio.md` updated by the server; record results here

## Results (2026-10-22)

- **Checks:** shared 275 tests (30 new: `plan/morning`, `pomodoro/flexible`, `study-status`), server
  95 + the skipped live one (4 new: flexible sync, study status with a temp vault), web 97 (3 new),
  typechecks of shared, ui, server, web and mobile, web build, desktop installer.
- **Real try in a browser** (headless Edge over the DevTools protocol, throwaway account
  `morning-ui-*@local.test` with the old 09:30-12:30 B1 and a study session `00b`, at 10:30 on a
  Thursday): "Actualizar la mañana" turned B1 into 08:00-12:00 with `flexibleBlocks = 2` (the
  afternoon block untouched); the calendar draws "Estudio B1: ventana para 2 bloques". "Empezar bloque
  1" → check-in 4/3 → "Energía 4: propuesta de 150 min con focos de 40", moved to 120/30. The focus
  view filled the window with the timer, the plan (30·5·30·5·30·5·15) and the tutor on 00b §1/§2.
  "Cortar tramo" at once: the rating card for pomodoro 1, then the pause by itself (5 min) with
  "Empezar foco de 20 min" and "Propuesta más corta porque cortaste un tramo"; 3 s later still in
  the pause. "+" → 25, started: 25:00. "Ver la app" → the pill with "Vista de foco" and "Tutor".
  "Terminar bloque" → the morning card shows "Bloque 1 · 0 min de foco" and "Empezar bloque 2".
  Stored: session `block-<B1>-2026-10-22-1`, `flexible`, `plannedBlockMin` 120, `windowEndAt` 12:00,
  `blockEndAt` null, cut 1, plan 30·5·25·5·20·5·15; the `CHECK_IN` with `scope: block-start`, 4/3,
  E 4, proposed 150/40, chosen 120/30.
- **Dev user:** "Actualizar la mañana" applied (B1, B2, Pilar E → 08:00-12:00, same ids); the server
  rewrote `Estado_estudio.md` 30 s later with the "Mañanas" lines, the Notas section kept.
- **Fixed from that try:** the check-in card and the focus view showed white horizontal scrollbars
  (`overflow="scroll"`); now vertical only.
- Not tried live: the 12:00 rule, the pause-over notice and the reminders (they need the clock;
  covered by the shared tests), and the phone following a PC block (typecheck only).
- Plain pomodoros (no block) keep SoftFocusOverlay, which already fills the window during focus;
  the focus view is for block sessions.

## 7. Revision 2: shared rules (D20-D29)

- [x] 7.1 `horario.ts` v2: windows 09:00-13:00 and 14:00-18:00, suggested blocks, lunch 13:00-14:00, no 15:25 break, header dated; `templateToSchedules` one flexible schedule per suggestion; `EXCLUDED_WORK_WINDOWS` 13:00-14:00 (D20, D21)
- [x] 7.2 `morning.ts` → bands of a 0-100 diagnosis, lengths per band, `adjustPlannedBlock` (±10 within 60-120 and ≥ worked), done with 45, day status by window (D22-D24, D27); tests: 40/40 → 60/20, 100/100 → 120/40, the ±10 cases and bounds, 45 done and 30 not
- [x] 7.3 State machine: the plan as a budget (`START_FOCUS` appends focus + pause, applies the rule; closing when the next focus no longer fits or the window closed) (D25); tests: start at 10:10 loses nothing, the pause starts alone and the focus doesn't, a manual length is kept, window end → closing, a cut lowers the block
- [x] 7.4 Reminders at the suggested times (D28); tests: 11:00 with a block running → none, 11:00 idle → one, never twice, none after 13:00
- [x] 7.5 `weekdayV2Changes` for an existing timetable (D30); tests: ids kept, the second suggestion created, lunch moved, break deleted, Saturday untouched

## 8. Revision 2: server and logs

- [x] 8.1 Study status: the 45-minute criterion, morning and afternoon blocks, the per-pomodoro diagnoses and the chat's calibration events (D26, D27)

## 9. Revision 2: web and desktop

- [x] 9.1 Diagnosis sliders (0-100) at block start and before every focus; the rule's result shown (planned block before → after); the rating card feeds it (D22-D24, D26)
- [x] 9.2 Focus view: planned block, worked and left; the closing when it no longer fits (D25)
- [x] 9.3 Day view, plan and dashboard for the two windows; "Empezar" on each suggestion; "Actualizar la jornada" (D27, D30)
- [x] 9.4 Reminders at 09:00, 11:00, 14:00, 16:00 (D28)
- [x] 9.5 Vitest, typecheck, build, installer

## 10. Revision 2: phone (per open question 3)

- [x] 10.1 Types; no auto-start of any weekday block; blocking per D14 (afternoon included)
- [x] 10.2 start a suggested block and the next focus from the phone (sliders, rating, start)

## 11. Revision 2: checks and a real try

- [x] 11.1 shared, server, web tests and typechecks; desktop installer; mobile typecheck
- [x] 11.2 Real try (throwaway account): a morning block with diagnoses, the ±10 rule, a cut, the closing when it no longer fits, "Terminar bloque" after 45; the dev user's "Actualizar la jornada"; record results here

## Revision 2 results (2026-10-22)

- **Checks:** shared 279 tests (the revision's rules: bands, lengths, the ±10 rule and its bounds,
  what fits, completion by window, reminders at the suggested times, the weekday migration, the
  budget state machine), server 95 + the skipped live one, web 97, typechecks of shared, server, web
  and mobile, web build, desktop installer, release APK.
- **Fixed on the way:** a study-status write scheduled after the module closed ran on a disconnected
  database (only seen in tests); now skipped.
- **Real try in a browser** (throwaway `rev2-*@local.test`, two afternoon suggestions at 14:00 and
  16:00, at 14:3x): "Bloques de hoy" listed both with "Empezar"; diagnosis 60/55 → "Energía media: 90
  min con un primer foco de 30"; the focus view showed "Bloque planeado: 90 min". "Cortar tramo", the
  rating card at 80/100, then the next diagnosis 90/80: "Cortaste el tramo: −10 min · último pomodoro
  80/100", "Empezar foco de 40 min" → planned 80, plan 30·5·40·10. Logged: `block-start` (60/55,
  media, after 90), `pomodoro` (80, 0-100), `pomodoro-diagnosis` (90/80, alta, 90 → 80, the rule's
  reason). Fixed from it: an afternoon block without a study plan took the study labels; now
  "Pomodoro N".
- **Dev user:** "Actualizar la jornada" applied (17 changes: the mornings' first suggestions in place
  and their 11:00 siblings created, the afternoon at 14:00 and 16:00, lunch at 13:00, the 15:25 break
  deleted). An afternoon block started at 14:00 by an older client as a fixed block kept running.
- **Phone:** release APK installed over the old one (2026-10-16) with `adb install -r`; the
  accessibility service stayed bound (no crashed services) and the app started cleanly. Its pomodoro
  screen lists the day's suggestions with "Empezar" (0-100 bars, block and focus steppers), the next
  focus's diagnosis with the rule, "Cortar tramo", "Terminar bloque"; the rating sheet and the
  overlay's buttons are 0-100. Not tried by hand on the phone (it was in use).
- **Desktop:** reinstalled with this build.
- Not tried live: the reminders at 09:00/11:00/14:00/16:00 and the window's end (shared tests only).
- The phone build doesn't have the plain-label fix (it only matters without a study plan).

## 12. Revision 3: the weekday windows are work hours (2026-10-29)

The user: blocks stay flexible, but they live inside a work schedule; through it games and social media
are blocked whether a block is running or not, and lunch is free.

- [x] 12.1 Shared: `flexibleWorkWindows` / `flexibleWorkWindowNow` (attention/focus-status.ts) -- the
  09:00-13:00 and 14:00-18:00 windows on the days with an enabled flexible WORK schedule; Jest tests
  (between blocks, lunch, evening, Saturday, disabled).
- [x] 12.2 Web and desktop: `SoftFocusContext.isInWorkWindow`; `DesktopBlockingBridge` blocks every game
  and the social apps/sites through it. The rest of the FOCUS list still waits for a started focus.
  Fixed on the way: the context's memo missed `exitedThisBlock`, so "Volver al bloque" could leave the
  FOCUS list off until another input changed.
- [x] 12.3 Phone: the windows are pushed to the native work windows (`setWorkSocialLimit`), so
  `kickIfInWorkFocus` kicks games and social media out through them, with the RN process dead too.
- [x] 12.4 Spec: "Blocking follows the block" rewritten (revision 3).
- [x] 12.5 Desktop installer and release APK rebuilt and installed (2026-10-29). Tried at 10:55 on a
  Thursday with no block started: Instagram opened on the phone went straight home with the block
  popup; the accessibility service stayed bound after `adb install -r`. Not tried live: lunch at
  13:30, a game on the PC.
- [ ] 12.6 The PC's hosts file had lost the user's Modify grant (Docker Desktop rewrites it on
  start), so sites aren't blocked there until "conceder acceso" in Lista de bloqueo is accepted again.
