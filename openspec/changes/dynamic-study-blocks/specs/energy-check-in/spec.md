## ADDED Requirements

### Requirement: Check-in at block start
Starting a flexible block SHALL ask for motivation and concentration (1-5 each) and propose the block's
length and focus length from a fixed table in shared code; the user SHALL be able to adjust both before
starting (block 90-150 min, focus 20-40 min).

#### Scenario: Low energy
- **WHEN** motivation is 2 and concentration is 2
- **THEN** the proposal is a 90-minute block with 20-minute focuses

#### Scenario: High energy
- **WHEN** motivation is 5 and concentration is 5
- **THEN** the proposal is a 150-minute block with 40-minute focuses

#### Scenario: Middle, rounded
- **WHEN** motivation is 3 and concentration is 2 (energy 2.5)
- **THEN** the energy is 3 and the proposal is 120/30

#### Scenario: Manual adjustment
- **WHEN** the proposal is 120/30 and the user changes it to 105/25 before starting
- **THEN** the block is planned for 105 minutes with 25-minute focuses

### Requirement: Planned sequence
The block's plan SHALL alternate focus and pause (5 min after a focus under 40, 10 min after a 40) and
end with the 15-minute closing, fitting the chosen length.

#### Scenario: 150/40
- **WHEN** the block is 150 minutes with 40-minute focuses
- **THEN** the plan is 40, 10, 40, 10, 30, 5 and the 15-minute closing

### Requirement: Focus proposal before each focus
Before each focus the app SHALL propose its length: the check-in's focus length, or after a cut in that
block the worked minutes of the cut focus rounded down to 5 (never under 20); the user SHALL be able to
move it between 20 and 40.

#### Scenario: After a cut
- **WHEN** the block's focus length is 40 and the user cut the last focus at 27 minutes
- **THEN** the next focus is proposed at 25 minutes

#### Scenario: User override
- **WHEN** the proposal is 30 and the user sets 40
- **THEN** the focus runs 40 minutes

### Requirement: Check-in log
Each block start SHALL log a `CHECK_IN` focus event with the motivation, concentration, energy, the
proposed and chosen lengths and the block number, so the table can be calibrated later.

#### Scenario: Logged
- **WHEN** the user starts block 1 with 4/3, proposed 150/40, chosen 120/30
- **THEN** a `CHECK_IN` event with `scope: 'block-start'` holds those values
