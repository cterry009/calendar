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
The system SHALL allow users to assign a complexity score from 1 to 10 independent of difficulty. The system SHALL suggest a starting complexity score by analyzing keywords in the task's title and description, which the user may override.

#### Scenario: Set complexity score
- **WHEN** user sets complexity to 7 on a task
- **THEN** the system stores the score and includes it in progress analytics

#### Scenario: Auto-suggest complexity from task text
- **WHEN** user types a task title containing open-ended, multi-step language (e.g. "investigar", "diseñar")
- **THEN** the system pre-fills a higher suggested complexity score, which the user can adjust before saving

### Requirement: Estimation in pomodoros
The system SHALL require an explicit time estimate for every task, expressed as a number of pomodoros rather than raw minutes. When a task's estimate exceeds one pomodoro, the system SHALL automatically split it across multiple pomodoro slots.

#### Scenario: Estimate spanning multiple pomodoros
- **WHEN** user estimates a task at 3 pomodoros
- **THEN** the system schedules the task across 3 pomodoro slots, splitting work across separate focus sessions as needed

### Requirement: Natural-language quick add
The system SHALL let users create a task from a single line of free text typed directly in the calendar, parsing a title and auto-suggesting complexity and estimate without opening the full task form.

#### Scenario: Quick-add a task from the calendar
- **WHEN** user types a one-line task description into the calendar's quick-add field and submits it
- **THEN** the system creates a task with that title and pre-filled complexity/estimate suggestions

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
