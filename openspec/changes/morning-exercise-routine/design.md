# Design

## Context

Night blocking keeps the night list blocked after the night window until a confirmed jog
(Activity Recognition, `JogStatusReader`) or `WAKE_STEP_THRESHOLD` = 1500 steps since waking, at the
latest 09:30 (`NightBlockRules.isNightListBlocking`). The first use after the window shows
"¿Ya hiciste ejercicio?" (`maybeAskMorningExercise`); a yes logs `MORNING_EXERCISE_YES` and JS ticks the
"Ejercicio al despertar" habit (`recordWakeExercise`), which is also auto-completed by a `FitnessEntry`
of type "Trote". The study block suggestion starts at 09:00.

## Goals / Non-Goals

**Goals:** the prescribed routine on routine days, a jog on the others; an honest verification that
needs no extra hardware; nothing that pushes past the prescription (light first, pain stops).

**Non-Goals:** rep counting with the camera (task 5.15, later); medical advice beyond the PDF;
iOS.

## Decisions

1. **Prescription in code, copied verbatim** (`exercise/prescription.ts`), the same convention as
   `plan/horario.ts`: the PDF is the source; nothing is added that isn't in it. Videos are links
   opened outside the app (YouTube), not embedded.
2. **Weekly plan** `exercise/plan.ts`: Mon/Wed/Fri routine, Tue/Thu jog, Sat optional mobility +
   stretching, Sun rest. The routine day (Día 1-5) advances per completed routine session, not per
   calendar week, so a skipped day doesn't skip a routine. Target minutes: 45 in weeks 1-2 at light
   intensity, then +5 per week up to 60; weeks counted from the plan start Monday.
3. **Verification, in layers** (strongest available wins):
   - *Heart rate* (Health Connect, if a watch/band writes it): minutes in the prescribed band during
     the session. Verified at ≥ 20 min at or above light.
   - *Motion* (always available): a foreground service samples the accelerometer at ~10 Hz only
     during a started session and counts a minute active when the signal's magnitude variance is
     above a threshold calibrated on the user's first sessions. Verified at ≥ 60 % of the routine's
     planned minutes active. The phone must be on the body (pocket or armband) — stated in the UI.
   - *Self-report* (fallback): "Sí, ya hice" still ticks the habit but does not unlock the night list.
   Alternatives rejected: steps for a home routine (squats and bands give almost none); camera pose for
   every session (too heavy each morning; kept for 5.15).
4. **Unlock**: on a routine day the night list unlocks on a verified session, on a jog day on a
   confirmed jog or the steps (unchanged); 09:30 stays the cutoff on both.
5. **Storage**: a session is a `FitnessEntry` (`activityType` "Rutina", `durationMinutes`,
   `intensity` from Borg, `notes` with "Día N", verification kind and active minutes); the habit's
   `linkedFitnessActivityType` matches "Trote" and "Rutina". No new synced entity.
6. **Safety**: "Tengo dolor o molestia" ends the session, records it with that note, shows the PDF's
   instruction (stop and tell the medical department) and never counts as a miss or a cut.

## Risks / Trade-offs

- [Motion can be faked by shaking the phone] → it is for self-control, like the steps; heart rate is
  stronger when there is a watch.
- [Phone not on the body] → the session screen says it; low active minutes show why it wasn't verified.
- [Battery] → sampling only during a started session, never in the background otherwise.

## Open Questions

- Whether the user has a watch or band that writes heart rate to Health Connect (decides if layer 1
  is built now or later; the task list builds motion first either way).
