## ADDED Requirements

### Requirement: A tutor turn
`POST /tutor/turn` SHALL take the user's message, the note section being studied, an optional
conversation id and the exercise on the table, run Claude with that context, and answer with Claude's
message and action, the exercise now on the table, the attempt recorded if Claude graded, and the
section's game state.

#### Scenario: First turn of a block
- **WHEN** the user sends a message for AN1 §1 with no conversation and no current exercise
- **THEN** the server picks the exercise with `nextExercise`, starts a Claude session, and returns its id with Claude's message and that exercise

#### Scenario: Claude grades the answer
- **WHEN** the user answers the current exercise and Claude replies `calificar` with r = 0.5 and one hint
- **THEN** an attempt is recorded (gradedBy claude, b of the exercise, hints 1, feedback = the justification), the response carries it with the XP gained and the new θ, and the next exercise is on the table

### Requirement: The code decides, Claude proposes
The server SHALL accept a grade only for the current exercise with r in {0, 0.5, 1} and hints ≥ 0, and
a generated exercise only with a statement; the generated exercise's b SHALL be the engine's target,
not Claude's. Any other reply SHALL be answered with 502 `tutor_invalid_reply` and nothing recorded.

#### Scenario: Grade for another exercise
- **WHEN** Claude grades an exercise id that is not the current one
- **THEN** the answer is 502 and no attempt is recorded

#### Scenario: Generated exercise
- **WHEN** the engine asks for a generated exercise at b = 0.4 and Claude writes one claiming b = 2
- **THEN** the exercise on the table has b = 0.4 and an id `AN1#gen-<8 hex>`

### Requirement: Context is bounded
Each turn SHALL give Claude the current study session, the section's θ and level, the current exercise
with its reference answer and hint, and the note path with the section's line range, and SHALL let
Claude use only the Read tool, inside the vault.

#### Scenario: Section range
- **WHEN** the turn is for AN1 §3
- **THEN** the prompt names `Fundamentos/Analisis/AN1_analisis_real.md` and the first and last line of section 3

### Requirement: Conversations and concurrency
A conversation SHALL continue with `--resume` while the server knows its owner; an unknown or foreign
conversation id SHALL start a new conversation with a warning. A second turn of the same user while
one runs SHALL get 429.

#### Scenario: Server restarted
- **WHEN** a turn names a conversation the server doesn't know
- **THEN** a new conversation starts and `warnings` says so

### Requirement: Tutor unavailable
The server SHALL answer 503 `tutor_unavailable` with the reason, and record nothing, when the `claude`
binary is missing, times out, exits with an error or reports `is_error`.

#### Scenario: Claude not installed
- **WHEN** `TUTOR_CLAUDE_BIN` points to a missing file
- **THEN** the turn answers 503 and no attempt exists

### Requirement: Game state without Claude
`GET /tutor/state` SHALL return the replayed state of a section (θ, level, attempts, XP, combo, review
queue, bosses of the note) and the next exercise, without calling Claude.

#### Scenario: Fresh section
- **WHEN** a user with no attempts asks for AN1 §1
- **THEN** θ is 0, XP is 0, and the next exercise is the one `nextExercise` picks

### Requirement: Section line ranges
`noteSections(fileName, markdown)` SHALL return every section of a note (numbered `##`, `###` under
Desarrollo, and the two closings) with its title and its first and last line, using the same rules as
`parseExercises`.

#### Scenario: Sections of AN1
- **WHEN** the AN1 fixture is read
- **THEN** sections 1 and 3 and both closings come back with line ranges that contain their exercises
