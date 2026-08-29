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

#### Scenario: Health Connect unavailable falls back to on-device counting
- **WHEN** Health Connect is not installed/available on the device
- **THEN** the system falls back to counting steps from the device's own foreground sensor session instead of showing nothing

### Requirement: Background-tolerant step sensitivity
The system SHALL clamp implausible step-count bursts (vibration/false-positive artifacts) against the maximum sustained human cadence, and SHALL smooth live updates so a brief spurious sensor blip does not inflate the count.

#### Scenario: Vibration burst filtered
- **WHEN** the step sensor reports a burst of steps far exceeding what a person could take in that time span
- **THEN** the reported delta is clamped to a plausible value instead of accepted as-is

### Requirement: Jog/run activity detection
The system SHALL detect, on Android, when the user is jogging/running -- independent of whether the app is in the foreground -- using the platform's activity-recognition service, and SHALL record that a jog occurred that day.

#### Scenario: Jog detected in the background
- **WHEN** the user starts running with the app closed
- **THEN** the system confirms a jog for that calendar day once the platform's activity classifier reports it, without requiring the app to be open

#### Scenario: Confirmed jog auto-logs a fitness entry
- **WHEN** a jog is confirmed and its duration becomes known
- **THEN** the system creates a fitness entry for it automatically, without a manual log
