## ADDED Requirements

### Requirement: Manual fitness logging
The system SHALL allow users to manually log exercise entries with type, duration, intensity (low/medium/high), and optional notes.

#### Scenario: Log a workout
- **WHEN** user logs a 45-minute "running" session with medium intensity
- **THEN** the system stores the entry and displays it in the fitness section

### Requirement: Daily fitness summary
The system SHALL display daily and weekly summaries of exercise duration, session count, and activity type breakdown.

#### Scenario: View weekly fitness summary
- **WHEN** user opens the fitness dashboard
- **THEN** the system shows total exercise minutes and sessions for the current week

### Requirement: Fitness calendar integration
The system SHALL display fitness entries alongside tasks and pomodoros in the calendar view.

#### Scenario: Workout visible in calendar
- **WHEN** user logs a workout at 07:00
- **THEN** the calendar day view shows the workout block at that time

### Requirement: Fitness-productivity correlation
The system SHALL compute and display correlation between exercise days and productivity metrics (tasks completed, pomodoros completed).

#### Scenario: Correlation insight
- **WHEN** user has 14+ days of both fitness and productivity data
- **THEN** the system shows whether exercise days correlate with higher task completion

### Requirement: Health platform integration (phase 2)
The system SHALL support importing activity data from Apple Health (iOS) and Google Health Connect (Android) when permissions are granted.

#### Scenario: Import steps from Health Connect
- **WHEN** user grants Health Connect permissions on Android
- **THEN** daily step count and active minutes are imported and shown in fitness summary
