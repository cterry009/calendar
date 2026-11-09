# Spec Delta

## Purpose
Make the web and desktop app the low-friction "Agenda" interface the user chose: today first, a
full-screen mode, visible reasoning progress, a study view that can hide the clock and shows each
session's progress, and a timetable that is clearly organized and in sync.

## ADDED Requirements

### Requirement: Agenda look by default
Web and desktop SHALL use the Agenda palette and type by default, following the system's light or
dark setting, for users who never chose an appearance; a stored choice SHALL be kept.

#### Scenario: First open
- **WHEN** a user with no stored appearance opens the app on a dark system
- **THEN** it shows "Agenda oscuro"

### Requirement: Today is the home
The home screen SHALL show the current or next block with a single primary action to start or
continue it, today's tasks and habits, and what comes next. Starting the current block SHALL take at
most two clicks from opening the app.

#### Scenario: Morning
- **WHEN** the user opens the app at 09:02 on a weekday
- **THEN** the first block of the morning is shown with "Empezar" as the primary action

### Requirement: Full-screen mode
The desktop app SHALL offer a full-screen mode without navigation chrome showing the current block,
the timer, the next block and the study session as large tiles, navigable with the keyboard, entered
with F11 or a button and left with Esc.

#### Scenario: Leave
- **WHEN** the user presses Esc in full-screen mode
- **THEN** the app returns to the window and screen it came from

### Requirement: Reasoning progress
While the tutor works, the app SHALL show "Pensando…" with the seconds elapsed and short summarized
details of what it is doing as they happen, never the full reasoning, and SHALL still show the final
result if the progress stream is lost. The planner SHALL show the same display.

#### Scenario: Grading
- **WHEN** the user sends an answer to the tutor
- **THEN** a counter and details such as "revisando tu paso 2" appear before the grade, and the grade appears as today

### Requirement: Time estimate
With at least three past turns of the same kind, the tutor SHALL show how long that kind of turn
usually takes (the median of the user's last 20).

#### Scenario: New user
- **WHEN** the user has fewer than three graded turns
- **THEN** no estimate is shown

### Requirement: Study clock can be hidden
The study section SHALL let the user hide the clock; the session SHALL keep timing, recording and
notifying segment changes as with the clock shown.

#### Scenario: Hidden clock
- **WHEN** the clock is hidden and a focus segment ends
- **THEN** the pause starts and the user is notified, with no countdown shown

### Requirement: Progress per study session
Each study session SHALL show its own progress: focus minutes, exercises done and correct, change of
level per section, and the session's check-ins and ratings.

#### Scenario: After a session
- **WHEN** a morning study block ends
- **THEN** its summary lists those figures for that session only

### Requirement: Progress bar to the next section
The study section SHALL show, for the current pensum section, a bar of its level toward mastery. When
the section reaches mastery with at least 5 exercises done in it, the next section SHALL unlock, the
bar SHALL say so, and the next study block SHALL start in the new section.

#### Scenario: Not enough exercises
- **WHEN** the level reaches mastery after 3 exercises
- **THEN** the bar is full but the section stays current until 5 exercises are done

### Requirement: Timetable organized and in sync
The timetable SHALL be shown as a week grid of blocks with their category and title, pending template
updates SHALL be reviewed and applied in one step, and the app SHALL show whether its changes are
saved on the server, pending, or offline.

#### Scenario: Offline
- **WHEN** the API is unreachable and the user edits a block
- **THEN** the timetable shows the change as pending until it reaches the server
