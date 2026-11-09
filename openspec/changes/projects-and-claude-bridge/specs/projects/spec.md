# Spec Delta

## Purpose
Keep the user's projects (research, studies, applications, side projects) in the calendar, with
their progress log and linked tasks, synced across every device like the other entities.

## ADDED Requirements

### Requirement: Project record
The system SHALL store, per user, projects with a title, an optional one-line summary, a status
(active, paused, blocked, idea, done), a priority (high, medium, low), an optional area, an
optional color, an optional deadline day, an optional progress from 0 to 100, an ordered list of
next steps and an optional blocker note. A progress left empty SHALL be shown as "not estimated",
never as 0%.

#### Scenario: Project without an estimate
- **WHEN** a project is saved without progress
- **THEN** every client shows it as "Avance sin estimar" and no percentage

#### Scenario: Invalid progress
- **WHEN** a client or Claude sends a progress outside 0–100
- **THEN** the change is rejected and nothing is stored

### Requirement: Tasks belong to at most one project
A task SHALL have zero or one project. Deleting a project SHALL keep its tasks and log entries,
with the tasks no longer linked to it.

#### Scenario: Project deleted
- **WHEN** the user deletes a project that has three open tasks
- **THEN** the three tasks remain, without a project, and nothing else is deleted

### Requirement: Project log
The system SHALL keep a log of dated entries per project, each with its text and its source (app or
Claude). Entries SHALL be listed newest first.

#### Scenario: Progress logged from Claude
- **WHEN** Claude logs "Terminé el benchmark de la cavidad" on the PINNs project
- **THEN** the entry appears on the phone and the desktop on their next sync with source Claude

### Requirement: Projects sync like the other entities
Projects and log entries SHALL be part of the sync snapshot and of sync batches, offline included,
with the most recent update winning on conflict. Clients with a cached snapshot from before this
change SHALL treat the missing lists as empty.

#### Scenario: Offline edit
- **WHEN** the user edits a project offline on the phone and later reconnects
- **THEN** the edit reaches the server and the other devices are notified

### Requirement: Projects that need attention
A project SHALL be flagged as needing attention when it is blocked, when its deadline is within the
next 14 days, or when it is active and has no log entry in the last 10 days (or none at all). Done
and idea projects SHALL never be flagged. Every place that lists such projects SHALL use this same
rule and give the reason.

#### Scenario: Stale project
- **WHEN** an active project's last log entry is 12 days old
- **THEN** it is flagged with the reason "sin avances hace 12 días"

#### Scenario: Idea not flagged
- **WHEN** a project's status is idea and it has no entries
- **THEN** it is not flagged

### Requirement: Attention in the daily email
The 21:00 daily report SHALL include the projects that need attention, with their reasons, and
SHALL leave the section out when there are none.

#### Scenario: Nothing to flag
- **WHEN** no project needs attention
- **THEN** the email has no projects section
