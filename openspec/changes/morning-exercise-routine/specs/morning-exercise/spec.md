# Spec Delta

## Purpose
Turn the user's exercise prescription into the morning exercise: the right activity each day, a
guided routine, a verification with the phone's sensors, and the habit and the night unlock fed by it.

## ADDED Requirements

### Requirement: Morning plan by weekday
The system SHALL plan the morning exercise as: Monday, Wednesday and Friday the prescribed routine;
Tuesday and Thursday a jog; Saturday optional mobility and stretching; Sunday rest. Routine sessions
SHALL follow Día 1 to Día 5 of the prescription in turn, advancing only when a routine session is done.

#### Scenario: Skipped Monday
- **WHEN** the user does no routine on Monday (Día 2 was next)
- **THEN** Wednesday's routine is still Día 2

### Requirement: Duration and intensity follow the prescription
The planned session SHALL be 45 minutes at light intensity in the first two weeks of the plan and
grow 5 minutes per week up to 60. Every session SHALL show the intensity bands (heart rate and Borg)
of the prescription.

#### Scenario: Week 4
- **WHEN** the plan is in its fourth week
- **THEN** the routine's planned length is 55 minutes

### Requirement: Morning question by day
The first phone use after the night window SHALL ask "¿Ya hiciste los ejercicios básicos?" with the
day's routine on routine days and "¿Ya saliste a trotar?" on jog days, with the current progress.

#### Scenario: Wednesday
- **WHEN** the user picks up the phone on a Wednesday at 08:05
- **THEN** the question names the routine day planned for that session

### Requirement: Guided session
The phone SHALL guide a routine session phase by phase (mobility, strength, cardio, stretching) with
the prescription's video links and a timer, and SHALL ask the perceived effort (Borg 0-10) at the end.
A "Tengo dolor o molestia" action SHALL end the session at once, record it, show the prescription's
instruction to stop and inform the medical department, and SHALL NOT count as a missed session.

#### Scenario: Pain
- **WHEN** the user taps "Tengo dolor o molestia" in the strength phase
- **THEN** the session ends, is stored with that note, and the next routine day is not advanced

### Requirement: Verification with sensors
A routine session SHALL be verified when heart rate (if available) shows at least 20 minutes at or
above the light band, or, without heart rate, when at least 60 % of its planned minutes are active by
the phone's motion sensors. Motion SHALL be sampled only during a started session and processed on
the device. A self-reported session SHALL tick the habit but SHALL NOT be verified.

#### Scenario: Phone left on the table
- **WHEN** a 45-minute session ends with 6 active minutes
- **THEN** it is stored as not verified and the screen says the phone must be on the body

### Requirement: Night unlock and habit
On a routine day the night list SHALL unlock when a session is verified; on a jog day on a confirmed
jog or the steps since waking; on any day at the 09:30 cutoff. A verified session or a jog SHALL tick
"Ejercicio al despertar" for that day.

#### Scenario: Verified routine
- **WHEN** a Friday session is verified at 08:52
- **THEN** the night list unlocks at once and the habit is done for Friday
