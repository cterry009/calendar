## ADDED Requirements

### Requirement: Calendar day view
The system SHALL display a day view showing scheduled tasks, work blocks, rest periods, and pomodoro sessions for the selected date.

#### Scenario: View today's schedule
- **WHEN** user opens the calendar on any device
- **THEN** the system displays the current day's events ordered by start time

### Requirement: Calendar week and month views
The system SHALL provide week and month views that summarize task density and scheduled focus blocks.

#### Scenario: Switch to week view
- **WHEN** user selects week view
- **THEN** the system displays seven days with task indicators and total estimated hours per day

### Requirement: Work schedule configuration
The system SHALL allow users to define recurring work hours covering one or more days of the week in a single schedule record (e.g., Mon–Fri 09:00–18:00 as one entry), with the end time optionally derived from the configured pomodoro block plan rather than entered manually.

#### Scenario: Set work hours across multiple days
- **WHEN** user configures a work schedule for Monday through Friday in one step
- **THEN** the system stores a single schedule covering all five days and highlights work blocks in the calendar for each

#### Scenario: Fixed lunch window excluded from work blocks
- **WHEN** a work schedule's range overlaps the fixed 12:30–13:30 window
- **THEN** the system excludes that window from focus/pomodoro planning within the block

### Requirement: Rest schedule configuration
The system SHALL allow users to define recurring rest/break windows within work hours.

#### Scenario: Add lunch break
- **WHEN** user adds a daily rest window from 13:00 to 14:00
- **THEN** the system displays the rest block in the calendar and excludes it from auto-scheduled focus time

### Requirement: Cross-device schedule sync
The system SHALL synchronize calendar events and schedule configuration across all logged-in devices within 30 seconds.

#### Scenario: Schedule updated on desktop
- **WHEN** user changes work hours on desktop
- **THEN** the updated schedule appears on mobile within 30 seconds
