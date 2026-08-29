## ADDED Requirements

### Requirement: Habit tracking with daily check-in
The system SHALL let users define habits (a title, NORMAL/build or NEGATIVE/avoid type, a daily goal value/unit, a target consolidation period, and an optional category) and log a daily check-in (DONE or SKIPPED, with a value) for each habit, synced across devices.

#### Scenario: Create a habit
- **WHEN** user creates a habit titled "Trote" with a daily goal of 1 "vez"
- **THEN** the system stores it and syncs it to all the user's devices

#### Scenario: Check in a habit for today
- **WHEN** user marks "Trote" as done for today with value 1
- **THEN** the system records a DONE check-in for that habit and date

### Requirement: Habit consolidation score
The system SHALL compute a 0-100 consolidation score per habit from its check-in history, using a sigmoid growth curve calibrated to the habit's target consolidation days, replayed fresh from the habit's creation date whenever displayed.

#### Scenario: Score reflects consistent check-ins
- **WHEN** a habit has been checked in as DONE every day since creation
- **THEN** its score trends toward 100 as more consecutive days accumulate

### Requirement: Auto-completion from a linked fitness activity
The system SHALL let a habit optionally link to a fitness activity type (case-insensitive match); when a fitness entry with a matching activity type is logged, the system SHALL automatically create or update that day's check-in for the linked habit instead of requiring a manual one.

#### Scenario: Logging a run auto-completes the linked habit
- **WHEN** a habit is linked to activity type "Trote" and a fitness entry with activityType "Trote" is logged for today
- **THEN** today's check-in for that habit is automatically created/updated, marked as auto-completed

### Requirement: Mobile habit tracking
The system SHALL provide the same habit creation, listing, and daily check-in capability on the Android mobile app as on web, reading and writing the same synced Habit/HabitRecord data.

#### Scenario: Habit created on mobile is visible on web
- **WHEN** user creates a habit from the mobile app
- **THEN** the habit and its check-ins appear identically after syncing on the web app

### Requirement: Daily habit reminder with quick habits templates
The system SHALL let a habit optionally have a reminder time window (a start/end minute-of-day and days of week) on mobile, and SHALL offer one-tap quick-add templates for common daily habits (wake-up time, getting ready, sport/jogging, dog walks, work hours, study hours, socializing) pre-filled with sensible reminder windows where a default makes sense.

#### Scenario: Quick-add a template habit
- **WHEN** user taps the "Deporte / trotar" quick-add template
- **THEN** a habit is created with that title, linked to the jogging activity type, and a reminder window already set

### Requirement: Habit confirmation notification
The system SHALL, on mobile, send a local notification with Si/No actions at a habit's configured reminder time, and SHALL record a DONE or SKIPPED check-in for that habit and day based on which action the user taps, without requiring the user to open the app.

#### Scenario: Confirming from the notification
- **WHEN** the "Arreglarse" habit's reminder fires and the user taps "Si"
- **THEN** today's check-in for that habit is recorded as DONE

#### Scenario: Reminder rescheduled when the habit changes
- **WHEN** a habit's reminder time or days are edited, or the habit is deleted/archived
- **THEN** its previously scheduled reminder notifications are cancelled and, if still applicable, rescheduled to the new time
