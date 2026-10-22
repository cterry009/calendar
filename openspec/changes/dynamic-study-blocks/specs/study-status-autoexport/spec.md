## ADDED Requirements

### Requirement: Server writes the study status
The server SHALL regenerate `Estado_estudio.md` and `estado_estudio.json` in the vault within about 30
seconds after a sync batch changes the configured user's tasks, exercise attempts, focus events or
pomodoro sessions, with the same content the manual script produces, keeping the hand-written "Notas"
section.

#### Scenario: Session done
- **WHEN** the user marks a study session done in the end-of-block card
- **THEN** within a minute `Estado_estudio.md` shows it done and its generation time is updated

#### Scenario: Notes kept
- **WHEN** the file has text between `<!-- notas:inicio -->` and `<!-- notas:fin -->`
- **THEN** that text is the same after the server rewrites the file

### Requirement: Only the configured user
The server SHALL write the vault only for the user whose email is `STUDY_STATUS_EMAIL`; without it set,
it SHALL write nothing. A failed write SHALL be logged and SHALL NOT fail the sync.

#### Scenario: Test account
- **WHEN** a test account pushes a batch
- **THEN** the vault files are not touched

### Requirement: One builder
The manual script and the server SHALL build the status with the same shared code.

#### Scenario: Same output
- **WHEN** the script and the server build the status from the same data at the same time
- **THEN** both produce the same markdown and JSON
