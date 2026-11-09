# Spec Delta

## Purpose
Let the user run the calendar from a Claude chat: Claude reads the user's day, week, projects and
habits and makes the changes the user asks for, through the same API and sync rules as the apps.

## ADDED Requirements

### Requirement: Local bridge as its own device
The bridge SHALL run on the user's computer, reach only the calendar API, and authenticate as a
device of its own ("Claude") that appears in the user's device list and can be revoked there. It
SHALL never connect to the database directly. Its credentials SHALL be stored outside the
repository.

#### Scenario: Revoked
- **WHEN** the user revokes the Claude device
- **THEN** the bridge's next call fails with a message saying it must be signed in again, and no
  data changes

### Requirement: API unavailable
When the API cannot be reached, every tool SHALL answer with a short message saying the server or
Docker is not running and how to start them, and SHALL NOT report a change as done.

#### Scenario: Server down
- **WHEN** Claude calls a tool while the Nest server is stopped
- **THEN** the tool answers that the API is not running, with the start commands

### Requirement: Reading the user's state
The bridge SHALL provide read tools for: today (schedule blocks, tasks due or overdue, habits and
their check-ins, the pending plan suggestion), the next 7 days, the projects (with the attention
rule's flags and reasons), one project with its log and tasks, tasks by filter, habit history over
a date range, and the latest daily and weekly reports. Times SHALL be given in the user's time
zone.

#### Scenario: How is my week going
- **WHEN** Claude asks for the week
- **THEN** it gets each day's tasks done and pending, habits against their goals and the flagged
  projects, enough to answer without further calls

### Requirement: Changing the user's data
The bridge SHALL let Claude create and update tasks (including linking a project), mark tasks done
or pending, create and update projects, add project log entries, record or correct a habit
check-in for a day, and approve or dismiss the pending plan suggestion. Every change SHALL go
through the same validation, server rules (the block commitment included) and conflict handling as
a change from the apps, and other devices SHALL be notified as for any sync.

#### Scenario: Task added from chat
- **WHEN** the user tells Claude "agenda la tutoría del jueves a las 4" and Claude creates the task
- **THEN** the task appears on the phone and the desktop without a manual refresh

#### Scenario: Server refuses
- **WHEN** a change is refused (a conflict or a commitment rule)
- **THEN** the tool reports the refusal and its reason, and does not retry it

### Requirement: Safety limits
The bridge SHALL change one record per call, identified by id, and SHALL offer no bulk delete. It
SHALL NOT change the block list, the night window, the block commitment, schedules or the study
plan. Deleting a task or project SHALL be a separate tool marked as destructive.

#### Scenario: Bulk delete asked
- **WHEN** Claude is asked to delete all of a project's tasks
- **THEN** it can only do so one task per call, each visible to the user
