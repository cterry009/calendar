# Tasks

## 1. Prescription and plan (shared)

- [x] 1.1 `packages/shared/src/exercise/prescription.ts`: the PDF as data (phases, five day routines with video links, intensity bands, progression, safety note). Verify: Jest test that the five days each have the four phases and every link is a YouTube URL.
- [x] 1.2 `exercise/plan.ts`: activity by weekday, routine day rotation advancing on done sessions, planned minutes by plan week. Verify: Jest tests (skipped Monday, week 1/3/4/8 lengths, Saturday optional, Sunday rest).
- [ ] 1.3 `exercise/verification.ts`: active-minute counting from motion windows, heart-rate band minutes, the verified rule. Verify: Jest tests with synthetic samples (still, walking, routine, shaking).

## 2. Find what failed

- [ ] 2.1 With the user: reproduce the morning flow end to end (answer, habit tick, jog auto-complete, events reaching the server) and write down each failure in this task. Verify: list agreed with the user.
- [ ] 2.2 Fix each failure found in 2.1, with a test where the code is testable. Verify: per fix.

## 3. Phone

- [ ] 3.1 Morning question by day in `maybeAskMorningExercise` (routine vs jog copy, day's routine name, progress). Verify: tried on the phone at the first use after the window.
- [ ] 3.2 Session screen (phases, timer, video links, pain action, Borg). Verify: a full session on the phone.
- [ ] 3.3 Motion-sampling foreground service during a session (accelerometer ~10 Hz, on-device windows, no raw data stored). Verify: still vs. routine sessions give clearly different active minutes.
- [ ] 3.4 Store the session as a `FitnessEntry` "Rutina"; habit link matches "Trote" or "Rutina". Verify: the habit ticks on the web after a verified session.
- [ ] 3.5 Unlock rule: verified routine on routine days in `NightBlockRules` / the accessibility service; relaunch with `monkey` and check accessibility after install. Verify: night list unlocks on a verified session, not on a self-report.
- [ ] 3.6 (If the user has a watch/band) Health Connect heart-rate read for the session window. Verify: band minutes shown after a session.

## 4. Web/desktop

- [ ] 4.1 The day's exercise (activity, routine day, planned minutes, last sessions) on the morning view. Verify: Vitest for the plan card; seen in the app.
