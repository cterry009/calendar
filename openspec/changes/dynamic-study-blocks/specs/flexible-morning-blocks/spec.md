## ADDED Requirements

### Requirement: Morning window
The timetable SHALL define the Monday-Friday morning study blocks (B1, B2, Pilar E) as a window from
08:00 to 12:00 in which the user aims for two study blocks, instead of a fixed 09:30-12:30 block.
Afternoon blocks and Saturday SHALL keep their fixed times and clock-anchored sequences.

#### Scenario: Template
- **WHEN** the weekly template is turned into schedules
- **THEN** Monday's "Estudio B1" is a WORK schedule from 08:00 to 12:00 with `flexibleBlocks = 2` and no sequence, and Monday's 14:00-15:25 block keeps its afternoon sequence

#### Scenario: Existing user
- **WHEN** the morning update is applied to a user whose B1 schedule is 09:30-12:30 with the morning sequence
- **THEN** the same schedule (same id) becomes 08:00-12:00 with `flexibleBlocks = 2` and no sequence, and its afternoon and Saturday schedules are not changed

### Requirement: Blocks start on demand
A flexible schedule's blocks SHALL NOT start by themselves on any device; each block SHALL start when
the user starts it, with its own session (`block-<scheduleId>-<date>-<n>`) on the schedule and the
line's current study session.

#### Scenario: Window opens
- **WHEN** it is 08:00 on a Monday and no block has been started
- **THEN** no pomodoro session is created on the PC or the phone

#### Scenario: Second block
- **WHEN** the user starts a block after finishing the day's first one
- **THEN** its session id ends in `-2`, it has the same `scheduleId`, and the tutor and the pill's "Tutor" button find its study session

### Requirement: Sequence anchored to the real start
A flexible block's segments SHALL run from the moment the user starts them; starting late SHALL NOT
skip any segment.

#### Scenario: Late start
- **WHEN** the user starts a 120/30 block at 10:10
- **THEN** the first segment is the first 30-minute focus, starting at 10:10, and all three focuses are still ahead

### Requirement: Automatic pause, manual focus
When a focus ends, its pause SHALL start by itself; the next focus (or the closing) SHALL start only
when the user starts it. When a pause runs past its length the app SHALL show one soft notice for that
pause.

#### Scenario: Focus ends
- **WHEN** a 30-minute focus reaches its end
- **THEN** the session is in a 5-minute pause without any user action

#### Scenario: Pause ends
- **WHEN** the 5-minute pause reaches its end and the user does nothing
- **THEN** the session stays in the pause, no focus starts, and one notice says the pause is over

### Requirement: Cutting a focus
"Cortar tramo" in a flexible block SHALL end the running focus, count it as a pomodoro and a cut, add
its worked minutes to the block's focus minutes, and start its automatic pause.

#### Scenario: Cut at 18 minutes
- **WHEN** the user cuts a 30-minute focus after 18 minutes
- **THEN** the pause starts, the cut count goes up by one and the block's focus minutes go up by 18

### Requirement: The 12:00 rule
After the window's end no new focus SHALL start in a flexible block; the focus already running SHALL
finish and the block SHALL go to its closing. Schedules after the window SHALL NOT move.

#### Scenario: Focus running at 12:00
- **WHEN** a focus started at 11:45 ends at 12:15
- **THEN** the pause is followed by the closing (not a focus), and the 14:00 block is unchanged

#### Scenario: Two blocks not done by 12:00
- **WHEN** it is 12:00 and only one block was done
- **THEN** nothing is moved or rescheduled and no reminder is shown

### Requirement: Blocking follows the block
During the morning window, app and site blocking SHALL be on only during the focus and closing
segments of a started flexible block, and off in its pauses and between blocks. Fixed blocks SHALL keep
blocking their whole window.

#### Scenario: Between blocks
- **WHEN** it is 10:30, the first block ended at 10:20 and the second hasn't started
- **THEN** nothing is blocked on the PC or the phone

#### Scenario: During a focus
- **WHEN** a focus of a flexible block is running
- **THEN** the PC's site/process blocking and the phone's app blocking are on, and the tray and the phone's notification show the block

### Requirement: Block and morning completion
A flexible block SHALL count as done when it has at least 60 minutes of real focus; the morning SHALL
count as fulfilled with two done blocks. The day view and the dashboard SHALL show both.

#### Scenario: 60 minutes
- **WHEN** a block ends with 60 minutes of focus
- **THEN** it counts as done

#### Scenario: 30 minutes
- **WHEN** a block ends with 30 minutes of focus
- **THEN** it doesn't count as done, and the morning shows 0 or 1 of 2 accordingly

### Requirement: Soft reminders
The PC SHALL remind the user to start a block at 08:20 and 08:50 when none has started, and 20 minutes
after the first block ended when the second hasn't started, never after the window's end or once the
morning is fulfilled, and at most `MAX_BLOCK_REMINDERS` times per morning.

#### Scenario: Cap
- **WHEN** both start reminders and one between-blocks reminder were shown
- **THEN** no other reminder is shown that morning

### Requirement: Sync of the new fields
The sync SHALL carry `Schedule.flexibleBlocks` and the session fields `flexible`, `plannedBlockMin`,
`windowEndAt` and `focusMinutes` through `/sync/pull` and `/sync/batch`; `focusMinutes` SHALL keep the higher
value on conflict; clients SHALL accept snapshots without them.

#### Scenario: Two devices
- **WHEN** the PC pushes `focusMinutes = 40` and the phone later pushes the same session with `focusMinutes = 30`
- **THEN** the server keeps 40
