## ADDED Requirements

### Requirement: Exercise attempts are synced as immutable records
The server SHALL accept `exerciseAttempts` in `POST /sync/batch` and create each one under its client id.
A second change with an id that already exists for the user SHALL be reported as `skipped` and SHALL NOT
modify the stored row, including when two copies race (unique-constraint error).

#### Scenario: Retried upload
- **WHEN** the same attempt is sent twice
- **THEN** the first is `applied`, the second `skipped`, and one row exists with the first's fields

#### Scenario: Correction is a new row
- **WHEN** an attempt with r = 0 is followed by another with `supersedes` set to its id and r = 1
- **THEN** both rows exist, unchanged, and replaying them gives the state of r = 1

#### Scenario: Correction arriving before the original
- **WHEN** an attempt whose `supersedes` names an id not yet on the server is sent
- **THEN** it is `applied`

### Requirement: Attempts are validated
The batch DTO SHALL reject an attempt whose `r` is not 0, 0.5 or 1, whose `b` is outside [−6, 6], whose
`hints` or `minutes` is negative, whose `exerciseSource` or `gradedBy` is not one of its values, or whose
texts exceed their limits (20 000 characters for `generatedStatement`, 10 000 for `feedback`).

#### Scenario: Invalid grade
- **WHEN** a batch carries an attempt with r = 0.7
- **THEN** validation fails

### Requirement: The pull carries the whole history without long texts
`GET /sync/pull` SHALL return all of the user's attempts, oldest first by (occurredAt, id), without
`generatedStatement` and `feedback`, and never another user's.

#### Scenario: Old attempts are included
- **WHEN** the user has an attempt from 400 days ago
- **THEN** it is in the pull

#### Scenario: Texts are left out
- **WHEN** an attempt has a generated statement and feedback
- **THEN** the pulled record has neither, and `GET /sync/exercise-attempts` returns both

### Requirement: Full attempts on request
`GET /sync/exercise-attempts` SHALL return the user's attempts with all fields, oldest first, from `since`
when given (an ISO date; anything else is a 400) or all of them otherwise.

#### Scenario: Since a date
- **WHEN** the user asks for attempts since a date
- **THEN** only the user's attempts from that date on are returned, oldest first

### Requirement: Clients read the attempts
The web and mobile snapshot types SHALL include `exerciseAttempts`, defaulting to an empty list when a
cached snapshot or an older server lacks it. The web client SHALL queue attempts offline and send them
through the sync batch.

#### Scenario: Cached snapshot without attempts
- **WHEN** the web app loads a snapshot cached before this change
- **THEN** it sees an empty list of attempts

### Requirement: The study status export shows the game
`scripts/export-study-status.mjs` SHALL add the game state per note (θ and level per section, XP and
global level, bosses unlocked and beaten, review queue), replayed from the pulled attempts and the catalog
parsed from the vault, to both output files, and SHALL say so when there are no attempts yet.

#### Scenario: No attempts yet
- **WHEN** the export runs before any attempt exists
- **THEN** the game section says there are no attempts yet
