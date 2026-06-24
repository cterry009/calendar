## ADDED Requirements

### Requirement: Task creation with metadata
The system SHALL allow users to create tasks with title, description, scheduled date/time, duration estimate, difficulty (easy/medium/hard), complexity score (1–10), priority, and category.

#### Scenario: Create a task with full metadata
- **WHEN** user creates a task with difficulty "hard", complexity 8, and estimated duration 90 minutes
- **THEN** the system saves the task and displays all metadata in the calendar

### Requirement: Task difficulty levels
The system SHALL support three difficulty levels: easy, medium, and hard. Difficulty MUST influence analytics grouping and scheduling suggestions.

#### Scenario: Filter tasks by difficulty
- **WHEN** user filters the task list by difficulty "hard"
- **THEN** the system shows only tasks marked as hard

### Requirement: Complexity estimation
The system SHALL allow users to assign a complexity score from 1 to 10 independent of difficulty.

#### Scenario: Set complexity score
- **WHEN** user sets complexity to 7 on a task
- **THEN** the system stores the score and includes it in progress analytics

### Requirement: Actual time tracking
The system SHALL record actual time spent on each task and compare it against the estimated duration.

#### Scenario: Complete task with time tracking
- **WHEN** user marks a task complete after working on it for 75 minutes (estimated 60)
- **THEN** the system records actual duration as 75 minutes and flags a 25% overrun

### Requirement: Task sync across devices
The system SHALL synchronize task CRUD operations across mobile, desktop, and web clients.

#### Scenario: Task created on mobile appears on desktop
- **WHEN** user creates a task on mobile
- **THEN** the task appears on desktop within 30 seconds
