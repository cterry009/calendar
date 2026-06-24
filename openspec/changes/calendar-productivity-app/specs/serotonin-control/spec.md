## ADDED Requirements

### Requirement: Serotonin mode activation
The system SHALL provide a "Modo Control de Serotonina" that users can activate manually or schedule (e.g., evening wind-down, post-work recovery).

#### Scenario: Manual activation
- **WHEN** user activates Serotonin Mode from any client
- **THEN** the system enters a low-stimulation state, enables distraction blocking, and displays suggested serotonin-supporting activities

### Requirement: High-dopamine input reduction during serotonin mode
The system SHALL block or add friction to high-dopamine digital inputs (social media, short-form video, games) during active Serotonin Mode, using the same platform blocking capabilities as focus mode.

#### Scenario: Block social apps during serotonin mode
- **WHEN** Serotonin Mode is active on Android
- **THEN** configured high-dopamine apps are blocked with a calm overlay suggesting an alternative activity

### Requirement: Serotonin-supporting activity pillars
The system SHALL track six presence pillars that support natural serotonin regulation: outdoors/sunlight, reading, meditation/mindfulness, journaling, social/family connection, and exercise.

#### Scenario: Log outdoor activity
- **WHEN** user logs 20 minutes of outdoor time during Serotonin Mode
- **THEN** the outdoors pillar progress updates and contributes to the daily serotonin score

### Requirement: Guided serotonin rituals
The system SHALL offer brief (≤5 min) guided rituals targeting calm and low stimulation: breathing, gratitude note, light stretch, sunlight reminder, or digital pause.

#### Scenario: Complete a ritual
- **WHEN** user completes a guided breathing ritual
- **THEN** the system records the ritual, awards serotonin score points, and suggests the next pillar if incomplete

### Requirement: Mood check-in
The system SHALL prompt for mood check-ins during Serotonin Mode using states: calm, anxious, low-energy, grateful, or restless.

#### Scenario: Mood check-in after ritual
- **WHEN** user completes a ritual
- **THEN** the system prompts for mood selection and stores it for analytics correlation

### Requirement: Serotonin score and streak
The system SHALL compute a daily serotonin score (0–100) based on pillar completion, rituals, mood stability, and reduced screen time during the mode. The system SHALL track consecutive days meeting a user-defined score threshold.

#### Scenario: Daily score calculation
- **WHEN** user completes 4 of 6 pillars and 2 rituals in one day
- **THEN** the system displays a serotonin score reflecting pillar and ritual completion

### Requirement: Low-stimulation UI during serotonin mode
The system SHALL switch to a muted, low-animation UI theme while Serotonin Mode is active to reduce visual overstimulation.

#### Scenario: UI theme change
- **WHEN** Serotonin Mode activates on web or desktop
- **THEN** the interface uses reduced contrast animations and a calm color palette until the mode ends

### Requirement: Cross-device serotonin mode sync
The system SHALL synchronize Serotonin Mode state, pillar progress, rituals, and mood entries across all logged-in devices.

#### Scenario: Mode started on mobile visible on desktop
- **WHEN** user activates Serotonin Mode on mobile
- **THEN** desktop shows active mode status and pillar progress within 30 seconds
