## ADDED Requirements

### Requirement: Success probability
`probability(theta, b)` SHALL return σ(θ − b) = 1 / (1 + e^−(θ−b)).

#### Scenario: Even match
- **WHEN** θ equals b
- **THEN** the probability is 0.5

### Requirement: Ability update
`updateTheta(theta, b, r, attemptsSoFar, config)` SHALL return θ + K·(r − p) with
K = max(Kmin, K0/√(1 + attemptsSoFar)) (defaults K0 = 0.8, Kmin = 0.15) and p = probability(θ, b). It
SHALL throw for any r other than 0, 0.5 or 1.

#### Scenario: Improbable success
- **WHEN** θ = 0 and the user solves an exercise with b = 2 (r = 1)
- **THEN** θ rises by more than when solving one with b = −2

#### Scenario: Probable failure
- **WHEN** θ = 0 and the user fails an exercise with b = 2 (a failure that was likely, r = 0)
- **THEN** θ drops, by less than after failing one with b = −2

#### Scenario: Invalid grade
- **WHEN** r is 0.7
- **THEN** `updateTheta` throws

### Requirement: Deterministic replay
`replay(attempts, catalog, config)` SHALL compute the whole game state from the attempts: θ and attempt
count per section (`noteCode§section`), level per section, total XP and global level, current combo,
unlocked and beaten bosses per note, and the review queue. Attempts SHALL be deduplicated by id and
processed in (occurredAt, id) order, so the same attempts in any order give the same state. Generated
exercises (not in the catalog) SHALL be replayed with their own `b`.

#### Scenario: Shuffled history
- **WHEN** the same attempts are replayed in two different orders
- **THEN** both states are equal

### Requirement: Corrections replace grades
An attempt with `supersedes` SHALL replace the attempt it names, taking its place in the order; only the
last link of a chain counts. A `supersedes` naming an unknown id SHALL be treated as a normal attempt.

#### Scenario: User corrects Claude's grade
- **WHEN** Claude graded an attempt r = 0 and the user's correction (supersedes it) says r = 1
- **THEN** the state equals replaying the attempt with r = 1 alone, and the exercise is not in the review queue

### Requirement: Cold start
A section's first θ SHALL be the mean θ of the same note's non-closing sections already attempted, or 0
if there are none.

#### Scenario: Second section of a note
- **WHEN** section 1 of AN1 ended at θ = 1 and section 2 had no attempts
- **THEN** the first attempt in section 2 starts from θ = 1

### Requirement: XP, combo and levels
An attempt SHALL give 0 XP if r = 0, else clamp(round(10·r·2^(b − θ_before)), 1, 100) times the combo
multiplier (1 + 0.1 per previous consecutive attempt with r ≥ 0.5, max 1.5) times 3 for a boss, rounded.
The combo SHALL reset on r = 0 or after a gap longer than `comboGapMinutes` (90). The global level SHALL
be the largest n with 100·n^1.5 ≤ total XP (0 below 100). The section level SHALL be 1 below θ = −1,
then 2, 3, 4, 5 from θ = −1, 0, 1, 2.

#### Scenario: XP grows with the grade
- **WHEN** the same attempt is replayed with r = 0, 0.5 and 1
- **THEN** the XP is non-decreasing in r, and 0 for r = 0

#### Scenario: Combo
- **WHEN** three attempts with r = 1 happen within 90 minutes
- **THEN** the third earns 1.2 times its base XP; after a fourth with r = 0 the combo is back to 0

### Requirement: Bosses
A note's closing exercises SHALL be its bosses. A boss SHALL be unlocked while
probability(mean θ of the note's non-closing sections, b₀) ≥ 0.5, or once beaten; it is beaten by an
attempt with r = 1. Beating a 🔴 boss SHALL mark the note as closed.

#### Scenario: Locked boss
- **WHEN** a note's sections average θ = 0 and its 🔴 boss has b₀ = 1
- **THEN** the boss is locked

### Requirement: Review queue
An attempt with r = 0 SHALL put its exercise in the review queue; an attempt with r = 1 SHALL take it out;
r = 0.5 SHALL leave it unchanged.

#### Scenario: Fail then solve
- **WHEN** an exercise is failed and later solved with r = 1
- **THEN** it is in the queue after the failure and not after the solve

### Requirement: Next exercise
`nextExercise(state, catalog, section, config)` SHALL target b* = θ − logit(p*) with p* = 0.8, using the
section's θ (or its cold-start value). Among the section's catalog exercises never attempted, excluding
locked bosses, it SHALL return `{ type: 'catalog', exercise }` for the one nearest to b* if
|b₀ − b*| < margin (0.75), ties by note order; otherwise `{ type: 'generate', targetB: b* }`.

#### Scenario: Solved exercises are not repeated
- **WHEN** an exercise of the section was already solved
- **THEN** it is never returned

#### Scenario: Catalog exhausted
- **WHEN** every exercise of the section has been attempted
- **THEN** the result is `{ type: 'generate', targetB }` with targetB = θ − logit(0.8)

#### Scenario: Locked boss not offered
- **WHEN** the section is a closing whose bosses are all locked
- **THEN** the result is `{ type: 'generate', ... }`

### Requirement: Convergence
The engine SHALL converge, measured on 100 simulated students whose true θ is drawn uniformly from
[−2, 2] with a fixed seed. Each answers the exercises chosen by `nextExercise` (generated ones at
targetB) with p = σ(θ_true − b), drawn from the same seeded generator, for 60 attempts. Then: at least
75 of the 100 estimates are within 0.5 of θ_true; the success rate averaged over all attempts of all
students is 0.8 ± 0.03; and the bias |mean(θ̂ − θ_true)| over the 100 students is below 0.15.

#### Scenario: Simulated students
- **WHEN** 100 seeded students with θ_true uniform in [−2, 2] each do 60 attempts
- **THEN** at least 75 end within 0.5 of θ_true

#### Scenario: Success rate on target
- **WHEN** the success rate is averaged over all 6000 attempts
- **THEN** it is between 0.77 and 0.83

#### Scenario: No large bias
- **WHEN** θ̂ − θ_true is averaged over the 100 students
- **THEN** its absolute value is below 0.15
