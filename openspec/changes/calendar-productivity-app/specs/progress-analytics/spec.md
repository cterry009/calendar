## ADDED Requirements

### Requirement: Productivity dashboard
The system SHALL display a dashboard with: tasks completed, pomodoros completed, estimated vs actual time, completion rate by difficulty, and focus hours per day/week.

#### Scenario: View weekly dashboard
- **WHEN** user opens the analytics dashboard
- **THEN** the system shows metrics for the current week with comparison to the previous week

### Requirement: Estimation accuracy tracking
The system SHALL calculate estimation accuracy per user and per difficulty level based on historical task data.

#### Scenario: Estimation accuracy report
- **WHEN** user has completed 10+ tasks with time estimates
- **THEN** the system shows average estimation error percentage grouped by difficulty

### Requirement: Improvement suggestions
The system SHALL generate actionable improvement suggestions based on user patterns using rule-based heuristics.

#### Scenario: Underestimation suggestion
- **WHEN** user's hard tasks consistently take 30%+ longer than estimated over 5+ instances
- **THEN** the system suggests increasing time estimates for hard tasks

#### Scenario: Missing break suggestion
- **WHEN** user completes 90+ minutes of focus without a recorded break
- **THEN** the system suggests scheduling a rest period

#### Scenario: Productivity peak insight
- **WHEN** sufficient historical data exists (14+ days)
- **THEN** the system identifies and displays the user's most productive time windows

### Requirement: Pomodoro interruption tracking
The system SHALL track pomodoro sessions that were cancelled or interrupted before completion.

#### Scenario: Interrupted pomodoro recorded
- **WHEN** user cancels a pomodoro with 10 minutes remaining
- **THEN** the system records the session as interrupted and includes it in analytics

### Requirement: Cross-device analytics consistency
The system SHALL aggregate analytics from all devices into a single unified view per user account.

#### Scenario: Combined mobile and desktop stats
- **WHEN** user completes tasks on both mobile and desktop
- **THEN** the dashboard reflects combined metrics without duplication
