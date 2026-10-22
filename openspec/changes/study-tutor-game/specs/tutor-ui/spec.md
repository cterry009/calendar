## ADDED Requirements

### Requirement: Tutor panel on the pomodoro page
The web app SHALL show a tutor panel in the pomodoro page. During a block whose pomodoro is on a study
task, the panel SHALL start on that task's note and sections; otherwise the user SHALL pick a note and a
section from `GET /tutor/notes`.

#### Scenario: Study block
- **WHEN** the running block's pomodoro is on the task `note:pensum_analisis.md#AN1#3.1` whose description says `Secciones: 4-5.`
- **THEN** the panel offers AN1 §4 and §5 and starts on §4

#### Scenario: No block
- **WHEN** no block is running
- **THEN** the panel lets the user pick any note and section that has exercises

### Requirement: Conversation with the tutor
The panel SHALL send each message to `POST /tutor/turn` with the conversation id, the exercise on the
table and, in a block, the pomodoro session and study task; it SHALL render the replies' markdown and
LaTeX, show that the tutor is thinking while a turn runs, and keep the conversation through a reload of
the page.

#### Scenario: Tutor unavailable
- **WHEN** the server answers 503
- **THEN** the panel shows the reason and the rest of the block works as before

### Requirement: Exercise card
The panel SHALL show the exercise on the table with a badge of its kind and its rendered statement, and
SHALL NOT show its reference answer.

#### Scenario: Card of a yellow exercise
- **WHEN** the exercise on the table is a 🟡 of the notes
- **THEN** the card shows the 🟡 badge and the statement, without the answer

### Requirement: Game feedback
After a grade the panel SHALL show the XP gained, the combo, θ and the section level, a notice when the
section or global level rises, and the note's bosses as locked, unlocked or beaten; animations SHALL be
off under `prefers-reduced-motion`.

#### Scenario: Level up
- **WHEN** a grade takes the section from level 2 to level 3
- **THEN** the panel shows the level-up notice

### Requirement: Correcting a grade
The user SHALL be able to correct the last grade to 0, 0.5 or 1; the correction SHALL be recorded as a
new attempt that supersedes the graded one, by the user, through the offline queue.

#### Scenario: Correction
- **WHEN** the user corrects an attempt graded 0 to 1
- **THEN** a new attempt with `supersedes` = that attempt's id, r = 1 and gradedBy `usuario` is sent, and the panel shows the replayed state

### Requirement: Block summary and dashboard
The card after a pomodoro SHALL add the tutor's summary for that pomodoro (exercises, XP, θ change) when
there were attempts in it, and the dashboard SHALL show the game: global level and XP, θ and level per
section, and the review queue.

#### Scenario: Pomodoro with exercises
- **WHEN** two attempts carry the finished pomodoro's session id
- **THEN** the rating card says two exercises with their XP

### Requirement: Note list endpoint
`GET /tutor/notes` SHALL return the notes with exercises in the vault: code, title, and each section's
key, title and number of exercises.

#### Scenario: Notes
- **WHEN** the vault has AN1 with sections 1 and 3 and a red closing
- **THEN** AN1 is listed with those three sections and their exercise counts
