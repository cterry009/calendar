## ADDED Requirements

### Requirement: Full-window focus view
While a pomodoro is active, the web and desktop app SHALL show a focus view that fills the app window
instead of the navigation and the current page: the timer, the running segment, the block's plan
progress, the controls for the phase, and the tutor panel for study blocks. It SHALL NOT bring the
window to the front or cover other apps.

#### Scenario: Study block focus
- **WHEN** a focus of a study block is running
- **THEN** the app window shows the timer, the segment label and the tutor panel on the block's study session, without the navigation

#### Scenario: Other apps
- **WHEN** the user switches to Obsidian during a focus
- **THEN** the app's window doesn't come back over it

### Requirement: Pause screen
During a pause of a flexible block the focus view SHALL show the pause countdown (or how long it has
run over), the proposed next focus with controls to change it, and a button to start it (the closing
after the window's end or when the plan has no focus left).

#### Scenario: Next focus
- **WHEN** the pause is running and the proposal is 30 minutes
- **THEN** the view shows "Empezar foco de 30 min" with − / + between 20 and 40

### Requirement: Collapsing the view
The user SHALL be able to collapse the focus view to the existing pill ("Ver la app") for the rest of
the current phase; the next phase SHALL show the view again.

#### Scenario: Collapse
- **WHEN** the user taps "Ver la app" during a pause
- **THEN** the app shows its pages with the pill, and the view comes back when the next focus starts
