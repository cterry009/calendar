## ADDED Requirements

### Requirement: Distraction list management
The system SHALL allow users to maintain a list of blocked applications (mobile) and websites/desktop applications (desktop) to restrict during focus sessions.

#### Scenario: Add app to block list
- **WHEN** user adds "Instagram" to the mobile block list
- **THEN** the system stores the entry and syncs it to all mobile devices

### Requirement: Block during pomodoro
The system SHALL activate distraction blocking automatically when a pomodoro focus session starts and deactivate it when the session ends or is cancelled.

#### Scenario: Block apps during pomodoro
- **WHEN** user starts a pomodoro focus session on Android
- **THEN** opening a blocked app shows an overlay preventing interaction until the session ends

### Requirement: Block during work hours
The system SHALL support an optional mode that blocks distractions during configured work hours regardless of pomodoro state.

#### Scenario: Work hours blocking enabled
- **WHEN** work-hours blocking is enabled and current time is within work schedule
- **THEN** blocked apps and sites are restricted on supported platforms

### Requirement: Block during specific task
The system SHALL allow enabling distraction blocking for the duration of a specific active task.

#### Scenario: Focus mode on single task
- **WHEN** user enables focus mode on task "Code review"
- **THEN** distractions are blocked until the task is completed or focus mode is disabled

### Requirement: Desktop site and app blocking
The system SHALL block configured websites and desktop applications on Windows and macOS during active focus sessions using a native agent.

#### Scenario: Block website on desktop
- **WHEN** user has "twitter.com" in the block list and starts a focus session on Windows
- **THEN** attempting to access twitter.com is prevented by the desktop agent

### Requirement: iOS degraded blocking mode
The system SHALL on iOS provide distraction reminders and a pre-focus checklist when full app blocking is unavailable.

#### Scenario: iOS focus session without Screen Time entitlement
- **WHEN** user starts focus on iOS without Screen Time permissions
- **THEN** the system shows a reminder notification and checklist of apps to close manually

### Requirement: Web soft focus mode
The system SHALL on web clients display a full-screen focus overlay with a visible timer but SHALL NOT claim OS-level blocking.

#### Scenario: Web focus session
- **WHEN** user starts focus on the web app
- **THEN** a focus overlay is shown with timer and blocked-item reminders without OS-level enforcement

### Requirement: Night block window
The system SHALL support a separate, user-enabled block list (independent from the pomodoro/work-hours list) that automatically restricts its entries on Android every night from 22:30 to 08:00, evaluated independent of whether the app process is running.

#### Scenario: App opened during the night window
- **WHEN** the night list is enabled, "Instagram" is on it, and the current time is 23:15
- **THEN** opening Instagram is blocked, the same way a pomodoro-blocked app is

#### Scenario: Night list is independent of the focus list
- **WHEN** an app is enabled on the night list but not on the pomodoro/work-hours list
- **THEN** that app is blocked at night but not during a daytime pomodoro session, and vice versa

### Requirement: Jog-to-unlock morning enforcement
The system SHALL, for the portion of the night window between midnight and 08:00, keep night-list apps blocked until the system detects the user has gone jogging/running that day, lifting the block immediately on detection or at 08:00 regardless, whichever comes first.

#### Scenario: Blocked until a jog is detected
- **WHEN** the current time is 06:30, night blocking is enabled, and no jog has been detected yet today
- **THEN** night-list apps remain blocked

#### Scenario: Jog detected before the cutoff
- **WHEN** a jog is detected at 06:45
- **THEN** night-list apps are unblocked immediately, without waiting for 08:00

#### Scenario: Hard cutoff with no jog
- **WHEN** the current time reaches 08:00 and no jog was detected
- **THEN** night-list apps are unblocked anyway
