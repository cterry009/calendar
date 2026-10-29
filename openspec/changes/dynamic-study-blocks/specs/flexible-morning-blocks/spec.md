## ADDED Requirements

### Requirement: Weekday windows
The timetable SHALL define Monday-Friday as two windows (revision 2, 2026-10-22): morning 09:00-13:00
with suggested study blocks 09:00-10:30 and 11:00-12:30 (the day's line: B1, B2 or Pilar E), and
afternoon 14:00-18:00 with suggested blocks 14:00-15:30 and 16:00-17:30 (the template's categories for
that day), with lunch 13:00-14:00. Each suggested block SHALL be a flexible Schedule of its own. Saturday
SHALL keep its fixed times and clock-anchored sequences.

#### Scenario: Template
- **WHEN** the weekly template is turned into schedules
- **THEN** Monday has "Estudio B1" at 09:00-10:30 and at 11:00-12:30, "Código de las notas" at 14:00-15:30 and the carrera block at 16:00-17:30, all with `flexibleBlocks = 1` and no sequence, lunch at 13:00-14:00, and Saturday's blocks keep their sequences

#### Scenario: Existing user
- **WHEN** "Actualizar la jornada" is applied to a timetable from revision 1 or before
- **THEN** each morning schedule keeps its id and becomes the first suggestion, a second schedule is created for the second one, the afternoon schedules keep their ids at the new times, lunch moves to 13:00-14:00, the 15:25 break is deleted, and Saturday doesn't change

### Requirement: Blocks start on demand
A flexible schedule's blocks SHALL NOT start by themselves on any device; each block SHALL start when
the user starts it, with its own session (`block-<scheduleId>-<date>-<n>`) on the schedule and, for a
study block, the line's current study session.

#### Scenario: Window opens
- **WHEN** it is 09:00 on a Monday and no block has been started
- **THEN** no pomodoro session is created on the PC or the phone

#### Scenario: Second suggestion
- **WHEN** the user starts the 11:00 suggestion after finishing the 09:00 one
- **THEN** its session is on the 11:00 schedule, and the tutor and the pill's "Tutor" button find its study session

### Requirement: Sequence anchored to the real start
A flexible block's segments SHALL run from the moment the user starts them; starting late SHALL NOT
skip any segment.

#### Scenario: Late start
- **WHEN** the user starts the 09:00 suggestion at 10:10 with a medium diagnosis
- **THEN** the first segment is a 30-minute focus starting at 10:10 and the planned block is 90 minutes from then

### Requirement: Automatic pause, manual focus
When a focus ends, its pause SHALL start by itself; the next focus (or the closing) SHALL start only
when the user starts it, after the diagnosis. When a pause runs past its length the app SHALL show one
soft notice for that pause.

#### Scenario: Focus ends
- **WHEN** a 30-minute focus reaches its end
- **THEN** the session is in a 5-minute pause without any user action

#### Scenario: Pause ends
- **WHEN** the 10-minute pause reaches its end and the user does nothing (the chat's pause lasted 29)
- **THEN** the session stays in the pause, no focus starts, and one notice says the pause is over

### Requirement: Cutting a focus
"Cortar tramo" in a flexible block SHALL end the running focus, count it as a pomodoro and a cut, add
its worked minutes to the block's focus minutes, start its automatic pause, and count as a low-energy
signal for the next adjustment.

#### Scenario: Cut at 18 minutes
- **WHEN** the user cuts a 30-minute focus after 18 minutes
- **THEN** the pause starts, the cut count goes up by one, the block's focus minutes go up by 18, and the next focus start lowers the planned block by 10

### Requirement: Closing early
"Terminar bloque" SHALL end a flexible block at any moment, counting the focus done, without any other
consequence; the block counts as done if that focus reached the minimum.

#### Scenario: Tired after the minimum
- **WHEN** a block has 50 minutes of focus and the user taps "Terminar bloque"
- **THEN** the block ends cleanly and counts as done

### Requirement: Window end
After a window's end (13:00, 18:00) no new focus SHALL start in a block of that window; the focus
already running SHALL finish and the block SHALL go to its closing. Nothing after the window SHALL move.

#### Scenario: Focus running at 13:00
- **WHEN** a focus started at 12:45 ends at 13:15
- **THEN** the pause is followed by the closing (not a focus), and the 14:00 suggestion and lunch are unchanged

#### Scenario: Two blocks not done by 13:00
- **WHEN** it is 13:00 and only one morning block was done
- **THEN** nothing is moved or rescheduled and no morning reminder is shown

### Requirement: Blocking follows the block
The weekday windows (09:00-13:00, 14:00-18:00) SHALL be work hours (revision 3, 2026-10-29): games and
social media SHALL be blocked through them on the PC and the phone, whether a block is running or not,
and lunch (13:00-14:00) and the time outside the windows SHALL be free. The rest of the block list SHALL
be on only during the focus and closing segments of a started flexible block. Saturday's fixed blocks
SHALL keep blocking their whole window.

#### Scenario: Between blocks
- **WHEN** it is 10:40, the first block ended at 10:30 and the second hasn't started
- **THEN** games and social media are blocked on the PC and the phone, and the rest of the block list isn't

#### Scenario: Lunch
- **WHEN** it is 13:30 on a weekday
- **THEN** games and social media can be used

#### Scenario: During a focus
- **WHEN** a focus of a flexible block is running
- **THEN** the PC's site/process blocking and the phone's app blocking are on, and the tray and the phone's notification show the block

### Requirement: Block and day completion
A flexible block SHALL count as done when it has at least 45 minutes of real focus; the day's minimum
SHALL be fulfilled with two done blocks of the morning window. The day view and the dashboard SHALL show
both, and the afternoon's blocks without a minimum.

#### Scenario: 45 minutes
- **WHEN** a block ends with 45 minutes of focus
- **THEN** it counts as done

#### Scenario: 30 minutes
- **WHEN** a block ends with 30 minutes of focus
- **THEN** it doesn't count as done

### Requirement: Reminders at the suggested times
The PC SHALL show one soft reminder at each suggestion's start (09:00, 11:00, 14:00, 16:00) when no
block is running and that suggestion hasn't been started that day, never repeated for that suggestion
and never after its window's end.

#### Scenario: 11:00 with a block running
- **WHEN** it is 11:00 and the first block is still running
- **THEN** no reminder is shown

#### Scenario: 11:00 with nothing running
- **WHEN** it is 11:00, the first block ended at 10:40 and nothing runs
- **THEN** one reminder offers to start the 11:00 block, and it isn't repeated

### Requirement: Sync of the new fields
The sync SHALL carry `Schedule.flexibleBlocks` and the session fields `flexible`, `plannedBlockMin`,
`windowEndAt` and `focusMinutes` through `/sync/pull` and `/sync/batch`; `focusMinutes` SHALL keep the
higher value on conflict; clients SHALL accept snapshots without them.

#### Scenario: Two devices
- **WHEN** the PC pushes `focusMinutes = 40` and the phone later pushes the same session with `focusMinutes = 30`
- **THEN** the server keeps 40
