# Proposal

## Why

The user has an exercise prescription from sports medicine (Universidad El Bosque, October 2026: gain
muscle mass, improve cardiometabolic condition, adherence) and wants it to be the morning exercise
(2026-11-08): some days a jog, the other days the prescribed routine. Today the morning only knows
"jog or 1500 steps" — the phone asks "¿Ya hiciste ejercicio?" with a step count, the strength routine
doesn't exist anywhere, and the user reports the backend side didn't work well. A routine at home has
to be checked some other way than steps, with the phone's sensors.

## What Changes

1. **The prescription as data** in `packages/shared/src/exercise/` (copied from the PDF, like
   `horario.ts`): session structure (joint mobility 5-10 min → strength → cardio ≤ 30 min, elliptical
   or no-impact ≤ 15 → stretching, 20 s each), the five day routines with their videos, the
   intensity bands (light 90-122 bpm / Borg < 4, moderate 123-139 / Borg 4-6), the progression
   (light the first two weeks, +5 min per week, 45-60 min) and the safety rule (pain → stop).
2. **A weekly morning plan**: Monday, Wednesday, Friday the routine (Día 1 → Día 5 in turn, so the
   same muscle group never repeats within 48 h); Tuesday and Thursday a jog; Saturday optional
   mobility and stretching; Sunday rest. Strength 3 times a week, as prescribed.
3. **The morning question by day**: "¿Ya hiciste los ejercicios básicos?" on routine days, with the
   day's routine; "¿Ya saliste a trotar?" on jog days.
4. **A guided session on the phone**: phase by phase with the video links, a timer, "Tengo dolor o
   molestia" (ends it, never counts as a miss), and the perceived effort (Borg 0-10) at the end.
5. **Verification with the phone's sensors** (see design): motion during the session (accelerometer
   in a foreground service, on the device) counts active minutes; heart rate from Health Connect when
   a watch or band provides it; the jog keeps Activity Recognition. The night list unlocks on a
   verified session the way it does today on a jog or the steps.
6. **Fix the backend path**: the morning answer, the session and the habit check-in reach the server
   reliably (investigation task first: what failed).

## Capabilities

### New Capabilities
- `morning-exercise`: the prescription, the weekly morning plan, the morning question, the guided
  session, its verification and how it counts toward the habit and the night unlock.

### Modified Capabilities
<!-- none: openspec/specs/ is empty -->

## Impact

- `packages/shared/src/exercise/` (new: prescription, plan, verification rules) + Jest tests.
- `apps/mobile`: morning card/question copy by day, session screen, a motion-sampling foreground
  service (new native module or an extension of `step-tracking`), Health Connect read of heart rate
  (task 11.3 territory), unlock rule in `NightBlockRules.kt` / `FocusBlockAccessibilityService.kt`.
- Sync: a session stored as a `FitnessEntry` (`activityType` "Rutina", duration, intensity, notes
  with day and verification) — no new table expected; habit "Ejercicio al despertar" ticked from it.
- Web/desktop: the day's plan on the morning view (read-only).
