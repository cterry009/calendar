## ADDED Requirements

### Requirement: User account and authentication
The system SHALL require user authentication via email/password or OAuth (Google, Apple) to sync data across devices.

#### Scenario: Login on new device
- **WHEN** user logs in on a new device with existing credentials
- **THEN** all user data is downloaded and available locally

### Requirement: Real-time data synchronization
The system SHALL synchronize tasks, schedules, pomodoro state, block lists, fitness entries, and analytics across devices with latency under 30 seconds under normal network conditions.

#### Scenario: Real-time task update
- **WHEN** user edits a task on desktop
- **THEN** the change appears on mobile within 30 seconds

### Requirement: Offline operation with sync
The system SHALL allow full read/write operation offline and queue changes for synchronization when connectivity is restored.

#### Scenario: Offline task creation
- **WHEN** user creates a task without network connectivity
- **THEN** the task is saved locally and synced to the server when connectivity returns

### Requirement: Single active pomodoro enforcement
The system SHALL enforce at most one active pomodoro session per user account across all devices.

#### Scenario: Pomodoro conflict resolution
- **WHEN** user attempts to start a pomodoro on mobile while one is active on desktop
- **THEN** the system prompts to take over or cancel the existing session

### Requirement: Device management
The system SHALL list registered devices and allow users to revoke access for a specific device.

#### Scenario: Revoke device access
- **WHEN** user revokes a device from account settings
- **THEN** that device is logged out and its refresh tokens are invalidated

### Requirement: Platform support matrix
The system SHALL provide clients for Android, iOS, Windows, macOS, and web browser, sharing a consistent core feature set with platform-specific adaptations for distraction blocking.

#### Scenario: Feature parity with platform exceptions
- **WHEN** user accesses the app on any supported platform
- **THEN** calendar, tasks, pomodoros, analytics, and fitness features are available; blocking depth varies by platform as documented
