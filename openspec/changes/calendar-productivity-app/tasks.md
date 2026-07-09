## 1. Project scaffolding

- [x] 1.1 Initialize Turborepo monorepo with `apps/mobile`, `apps/desktop`, `apps/web`, `packages/shared`, `packages/ui`, `server`
- [x] 1.2 Configure TypeScript, ESLint, Prettier, and shared tsconfig across packages
- [x] 1.3 Set up Tamagui design system with theme tokens (colors, spacing, typography)
- [x] 1.4 Create Docker Compose for PostgreSQL and Redis local development
- [x] 1.5 Configure GitHub Actions CI pipeline (lint, typecheck, test)

## 2. Backend foundation

- [x] 2.1 Scaffold NestJS server with Prisma ORM and PostgreSQL connection
- [x] 2.2 Define Prisma schema: User, Device, Task, Schedule, PomodoroSession, BlockListEntry, FitnessEntry, AnalyticsSnapshot
- [x] 2.3 Implement email/password auth with JWT + refresh tokens
- [x] 2.4 Implement OAuth (Google, Apple) login endpoints
- [x] 2.5 Implement device registration and revocation endpoints
- [x] 2.6 Set up Socket.io gateway for real-time sync events
- [x] 2.7 Implement offline sync queue endpoint (batch upsert with conflict resolution)
- [x] 2.8 Add Swagger/OpenAPI interactive docs at `/docs`

## 3. Shared business logic

- [x] 3.1 Define Zod schemas for Task, Schedule, Pomodoro, BlockList, FitnessEntry in `packages/shared`
- [x] 3.2 Implement pomodoro state machine (idle â†’ focus â†’ short_break â†’ long_break)
- [x] 3.3 Implement estimation accuracy calculator (estimated vs actual per difficulty)
- [x] 3.4 Implement suggestion engine with rule-based heuristics
- [x] 3.5 Implement fitness-productivity correlation calculator
- [x] 3.6 Implement serotonin mode engine (pillars, rituals, score, mood check-in)
- [x] 3.7 Write unit tests for shared logic packages
- [x] 3.8 Implement serotonin detox initiation plan engine (multi-day phases, daily steps, baseline audit, progress tracking)

## 4. Web app (MVP phase 1)

- [x] 4.1 Scaffold Vite + React app with Tamagui and routing
- [x] 4.2 Implement auth screens (login, register, OAuth callback)
- [x] 4.3 Implement calendar day/week/month views
- [x] 4.4 Implement task CRUD with difficulty, complexity, and time estimate fields
- [x] 4.5 Implement work schedule and rest period configuration UI
- [x] 4.6 Implement pomodoro timer component with task linking
- [x] 4.7 Implement web soft-focus overlay mode
- [x] 4.8 Implement fitness manual logging and weekly summary view
- [x] 4.9 Implement productivity dashboard with charts
- [x] 4.10 Implement suggestions panel
- [x] 4.11 Implement Serotonin Mode UI (pillars, rituals, mood, score, calm theme)
- [x] 4.12 Integrate WebSocket client for real-time sync
- [x] 4.13 Add IndexedDB offline storage and sync queue
- [x] 4.14 Proponer horarios diferenciados por tipo de intensidad vinculados al plan de desintoxicación serotoninérgica
- [x] 4.15 Implement Serotonin Detox Plan UI (onboarding, plan de inicio multi-dia, checklist diaria, progreso por fase)
- [x] 4.16 Implement onboarding tutorial for new users (guided walkthrough)

## 5. Web UX & product enhancements (recommended before phase 2 — Android port)

> Informed by a review of the current web MVP plus research into comparable apps (Sunsama, Motion, Reclaim.ai,
> Opal, Freedom, One Sec, AppBlock, Elqi, Roots, Forest). Do this before porting screens to Android/Windows so
> the ported UX inherits the fixes instead of propagating the same gaps to two more platforms.

- [ ] 5.1 Build a shared app shell with persistent navigation (sidebar or top bar) replacing the per-page ad-hoc "go to X" button clusters (13 pages currently each hand-roll their own inconsistent set)
- [ ] 5.2 Persist Serotonin Mode session to IndexedDB + sync queue, matching the offline/sync pattern already used by tasks, fitness, schedules, and detox
- [ ] 5.3 Add a global quick-add for tasks (keyboard shortcut + persistent button) so capture doesn't require navigating to `/tasks`
- [ ] 5.4 Implement a guided daily planning ritual: morning review (pull today's tasks, time-box onto calendar) and an evening shutdown, wired into Serotonin Mode as a ritual
- [ ] 5.5 Surface overcommitment warnings on the calendar using the existing estimation-accuracy calculator when scheduled task time exceeds the configured work-schedule capacity for the day
- [ ] 5.6 Extend the suggestion engine to propose open time slots respecting work schedule/rest periods (assistive slot suggestions, not full auto-scheduling), and surface suggestions inline on the task form and calendar instead of only on the Suggestions page
- [ ] 5.7 Add a "hard mode" (non-cancelable) option to block-list entries, specified now so Android (6.6) and Windows (7.3) blocking implementations share one behavior instead of diverging
- [ ] 5.8 Build a shared "friction" overlay (brief breathing/mindfulness pause) as a softer alternative to a hard block, reused by the focus-blocking overlay (6.7/7.6) and as the serotonin-detox intervention when opening a high-dopamine app
- [ ] 5.9 Extend block-list trigger conditions beyond session-based (pomodoro/task/work-hours) to include location and Wi-Fi network conditions
- [ ] 5.10 Add "quality of screen time" tracking to Serotonin Mode: score temptations avoided (blocked-app opens declined) alongside pillar activities logged, not just activity minutes
- [ ] 5.11 Add a lightweight visual reward/streak view for completed pomodoro sessions on the Pomodoro page, closing the loop between finishing a session and seeing progress without a trip to the dashboard
- [ ] 5.12 Decide and enforce a single primary UI language (Spanish) across all pages ahead of full i18n (10.2), fixing the current English/Spanish mix on the Home page
- [ ] 5.13 Establish visual hierarchy on the Home page: group daily-driver actions (Calendar, Tasks, Pomodoro) separately from setup/config screens (Schedule, Block List)
- [ ] 5.14 Decide whether to add a light theme / `prefers-color-scheme` support alongside the existing dark/calm themes, or intentionally commit to dark-only as part of the focus/dopamine-reduction branding
- [ ] 5.15 Auto-split a general WORK schedule range into pomodoro/short-break/long-break sub-blocks (chunks of 4-5 pomodoros, max 4 long breaks per range) with a live preview on the schedule form and a mini-timeline on the calendar day view; add a self-reported concentration check-in during focus sessions that adapts the estimated pomodoro length over time

## 6. Mobile app â€” Android (phase 2)

- [ ] 6.1 Scaffold Expo app with shared UI components
- [ ] 6.2 Port auth, calendar, tasks, pomodoro, fitness, and analytics screens from web
- [ ] 6.3 Implement expo-sqlite offline storage and sync queue
- [ ] 6.4 Implement push notifications for pomodoro breaks and suggestions
- [ ] 6.5 Build Android block-list picker (installed apps enumeration)
- [ ] 6.6 Implement Android Accessibility Service for app blocking during focus
- [ ] 6.7 Implement overlay UI when blocked app is opened
- [ ] 6.8 Test blocking during pomodoro, task focus, and work-hours modes

## 7. Desktop app â€” Windows (phase 3)

- [ ] 7.1 Scaffold Tauri 2 app wrapping shared React UI
- [ ] 7.2 Implement Tauri system tray with pomodoro quick controls
- [ ] 7.3 Build Rust sidecar for process blocking (configured desktop apps)
- [ ] 7.4 Implement hosts-file / DNS-based website blocking during focus
- [ ] 7.5 Implement block-list management UI for sites and desktop apps
- [ ] 7.6 Implement notification overlay shown when a blocked app or site is opened (parity with Android 6.7)
- [ ] 7.7 Test blocking during pomodoro and work-hours on Windows
- [ ] 7.8 Implement auto-start on boot (optional, user-configurable)

## 8. Mobile â€” iOS y desktop â€” macOS (fase 6 â€” baja prioridad)

> ImplementaciÃ³n nativa en iOS y macOS pospuesta hasta completar MVP web, Android y Windows.
> En iOS/macOS el valor inicial se entrega vÃ­a web + plan de desintoxicaciÃ³n sin bloqueo profundo del SO.

- [ ] 8.1 Build iOS app from Expo with platform-adapted blocking (Screen Time API or degraded mode) â€” **baja prioridad**
- [ ] 8.2 Implement iOS pre-focus checklist and reminder notifications â€” **baja prioridad**
- [ ] 8.3 Build macOS Tauri app with NSWorkspace-based app blocking â€” **baja prioridad**
- [ ] 8.4 Test iOS degraded mode and macOS blocking flows â€” **baja prioridad**

## 9. Analytics and fitness integrations (phase 5)

- [ ] 9.1 Implement nightly BullMQ job for analytics snapshot computation
- [ ] 9.2 Integrate Apple HealthKit for iOS fitness data import â€” **baja prioridad (depende de fase 6 iOS)**
- [ ] 9.3 Integrate Google Health Connect for Android fitness data import
- [ ] 9.4 Add CSV import for fitness data on desktop
- [ ] 9.5 Enhance suggestion engine with fitness-productivity correlation insights

## 10. Polish and release

- [ ] 10.1 Implement onboarding flow explaining permissions (blocking, health, notifications)
- [ ] 10.2 Add i18n support (Spanish and English)
- [ ] 10.3 Write end-to-end tests for critical flows (task â†’ pomodoro â†’ block â†’ complete)
- [ ] 10.4 Prepare app store listings (Google Play primero; App Store iOS â€” baja prioridad) and desktop installer (Windows primero; macOS â€” baja prioridad)
- [ ] 10.5 Set up production deployment (API, database, CDN) and monitoring
