## ADDED Requirements

### Requirement: Configurable pomodoro cycles
The system SHALL support configurable focus duration (default 25 min), short break (default 5 min), and long break (default 15 min) after a configurable number of cycles (default 4).

#### Scenario: Customize pomodoro duration
- **WHEN** user sets focus duration to 50 minutes
- **THEN** subsequent pomodoro sessions use 50-minute focus periods

### Requirement: Pomodoro linked to task
The system SHALL allow starting a pomodoro session linked to a specific task, recording completed focus intervals against that task.

#### Scenario: Start pomodoro for a task
- **WHEN** user starts a pomodoro on task "Write report"
- **THEN** the timer runs and completed intervals are attributed to that task

### Requirement: Pomodoro auto-start during work hours
The system SHALL automatically activate pomodoro sessions during configured WORK schedule blocks, without requiring the user to manually enable or start them per task.

#### Scenario: Auto-suggest during work block
- **WHEN** user begins a task during work hours with auto-pomodoro enabled
- **THEN** the system prompts to start a linked pomodoro session

### Requirement: Automatic work-block segmentation
The system SHALL auto-split each WORK schedule block into an ordered sequence of pomodoro, short-break, and long-break segments, based on a configurable pomodoro length, breaks length, pomodoros-per-chunk count, and chunk count per schedule. Long-break length SHALL scale between its configured min and max based on how many pomodoros make up a chunk. Any fixed excluded window (e.g. lunch) SHALL be carved out of the plan rather than scheduled over.

#### Scenario: Work block auto-splits into pomodoro slots
- **WHEN** a WORK schedule spans 09:00–13:00 with default pomodoro/break/chunk settings
- **THEN** the system generates an ordered plan of pomodoro and break segments covering that range, excluding any configured lunch window

#### Scenario: Customize the auto-generated plan per schedule
- **WHEN** user changes the pomodoros-per-chunk or chunk count for a specific WORK schedule
- **THEN** the system regenerates that schedule's block plan using the new values without affecting other schedules

### Requirement: Pomodoro state sync
The system SHALL synchronize active pomodoro state (running, paused, completed cycles) across devices, with only one active session per user at a time.

#### Scenario: Pomodoro started on desktop visible on mobile
- **WHEN** user starts a pomodoro on desktop
- **THEN** mobile shows the active timer with remaining time within 5 seconds

### Requirement: Break reminders
The system SHALL notify the user when a focus period ends and a break period begins.

#### Scenario: Focus period ends
- **WHEN** a 25-minute focus period completes
- **THEN** the system plays a notification and transitions to short break
