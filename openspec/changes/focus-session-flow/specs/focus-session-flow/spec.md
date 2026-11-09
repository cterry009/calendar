# Spec Delta

## Purpose
Keep a pomodoro from being dropped early, guide what comes next, and show what each session achieved,
the same for study, research, paper and work blocks.

## ADDED Requirements

### Requirement: A pomodoro ends only after 75 % of its focus
A running focus segment SHALL NOT be ended, cut, or have its block ended until 75 % of its planned
minutes of focus are done; until then the only action offered SHALL be pausing. Pausing SHALL keep the
focus done so far. Pauses and closing segments are not subject to this rule.

#### Scenario: Too early
- **WHEN** the user tries to end a 30-minute focus after 10 minutes
- **THEN** ending is disabled, "Pausar" is offered, and the screen says how many minutes remain until it can end

#### Scenario: Enough done
- **WHEN** 23 of 30 minutes of focus are done
- **THEN** the focus can be ended and its pause starts

### Requirement: Next pomodoro suggested
When a focus ends, the app SHALL suggest the next one: its length from the energy rules already used
by the dynamic blocks, and what to do in it from the block's kind — the next pensum section for study,
the project's next step for research and paper, the next task for work, or the category's suggested
labels when none applies.

#### Scenario: Study
- **WHEN** a study focus ends with a high rating
- **THEN** the suggestion names the next section to work on and a focus 10 minutes longer, within the limits

### Requirement: Per-session counters
Every block session SHALL count its completed pomodoros and focus minutes and its progress in topics
(sections for study, next steps or log entries for research and paper, tasks done for work), shown
while it runs and in its summary.

#### Scenario: Research block
- **WHEN** a research block ends after three pomodoros and one log entry
- **THEN** its summary shows 3 pomodoros, their focus minutes and 1 advance
