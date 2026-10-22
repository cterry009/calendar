## ADDED Requirements

### Requirement: Diagnosis before every pomodoro
Before a flexible block's first focus and before each of its next focuses, the app SHALL ask for
motivation and concentration on 0-100 each (revision 2, 2026-10-22). The band of their average SHALL be
low under 45, medium from 45 to 69 and high from 70. The first diagnosis SHALL propose the block's length
(low 60, medium 90, high 120 min) and each diagnosis its focus (low 20, medium 30, high 40 min); the user
SHALL be able to move them before starting (block 60-120 in steps of 10, focus 20-40 in steps of 5).

#### Scenario: Low energy start
- **WHEN** the first diagnosis is motivation 40 and concentration 40
- **THEN** the proposal is a 60-minute block with a 20-minute focus

#### Scenario: High energy start
- **WHEN** the first diagnosis is motivation 100 and concentration 100
- **THEN** the proposal is a 120-minute block with a 40-minute focus

#### Scenario: Manual adjustment
- **WHEN** the proposal is 90/30 and the user changes it to 80/25 before starting
- **THEN** the block is planned for 80 minutes and the focus runs 25

### Requirement: The block adjusts after each pomodoro
When the next focus starts, the planned block SHALL move +10 minutes if the last pomodoro's rating is 4
or more and the new diagnosis is high, −10 if the rating is 2 or less, the new diagnosis is low, or the
last focus was cut, and stay otherwise; always between 60 and 120 and never under the minutes already
worked in the block.

#### Scenario: Both signals high
- **WHEN** the block is planned at 90, the last pomodoro was rated 5 and the next diagnosis is high
- **THEN** the block is planned at 100

#### Scenario: Low after a cut
- **WHEN** the block is planned at 60 with 50 minutes already worked and the last focus was cut
- **THEN** the block stays at 60 (it can't go under 60 nor under what was worked)

#### Scenario: Upper bound
- **WHEN** the block is planned at 120 and both signals are high
- **THEN** it stays at 120

### Requirement: Planned sequence as a budget
Each focus SHALL be followed by its pause (5 min after a focus under 40, 10 after a 40), and the
15-minute closing SHALL be offered once another focus of at least 20 minutes with its pause and the
closing no longer fits the planned block.

#### Scenario: Closing offered
- **WHEN** the block is planned at 60 and 45 minutes have gone by
- **THEN** the next work offered is the closing, not a focus

### Requirement: Check-in log
Every diagnosis SHALL be logged as a `CHECK_IN` focus event with the 0-100 values, the band, the
proposed and chosen focus, the planned block before and after the rule and the cycle; the first of a
block SHALL also carry the proposed and chosen block.

#### Scenario: Logged
- **WHEN** the user starts block 1 with 90/80, proposed 120/40, chosen 110/40
- **THEN** a `CHECK_IN` event with `scope: 'block-start'` holds those values and `scale: '0-100'`
