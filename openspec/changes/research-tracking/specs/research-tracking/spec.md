# Spec Delta

## Purpose
Keep the user's master's programs, researchers and papers in the calendar, updated daily without
duplicates, with application deadlines on his calendar and a section to review them.

## ADDED Requirements

### Requirement: Research records per user
The system SHALL store, per user, programs (name, university, country, master's or direct PhD,
recommendation letters required, stochastic-process courses, groups, cost and scholarships, language,
next deadline, official link, score, status, the user's opinion, last verification), researchers
(name, affiliation, country, topics, whether they take students and in which program, institutional
page, last verification) and papers (title, authors, link, arXiv id, date, topic, why it matters,
reading status and level).

#### Scenario: Read back
- **WHEN** the app or Claude lists the programs
- **THEN** only that user's programs are returned, sorted by score

### Requirement: Daily updates without duplicates
Writing a program, researcher or paper that already exists (same official link, page, or arXiv id)
SHALL update it instead of creating another. Nothing SHALL be deleted by an update; a program no
longer valid SHALL be marked closed or discarded with its reason.

#### Scenario: Second run
- **WHEN** the radar writes the same program twice on two days
- **THEN** there is one row with the newer verification date

### Requirement: The user's judgement is kept
An automatic update SHALL NOT change the user's opinion, the status the user set, or a paper's reading
status and level.

#### Scenario: Opinion kept
- **WHEN** the user wrote "me interesa" on a program and the radar updates it the next day
- **THEN** the opinion is still "me interesa"

### Requirement: Deadlines on the calendar
A program with a deadline within the next 90 days SHALL have one task in the carrera category on that
date; if the deadline changes the task SHALL move, and if the program is discarded the task SHALL be
removed.

#### Scenario: Date moved
- **WHEN** a program's deadline changes from 2027-01-15 to 2027-01-31
- **THEN** its task is on 2027-01-31 and there is no task left on 2027-01-15

### Requirement: Research section in the app
Web and desktop SHALL show the programs, researchers and papers with filters (status, topic, deadline)
and let the user edit his opinion, the program status and a paper's reading status.

#### Scenario: Filter
- **WHEN** the user filters programs by "cierra en 60 días"
- **THEN** only programs with a deadline in that range are listed
