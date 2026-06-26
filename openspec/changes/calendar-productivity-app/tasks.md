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
- [ ] 4.6 Implement pomodoro timer component with task linking
- [ ] 4.7 Implement web soft-focus overlay mode
- [ ] 4.8 Implement fitness manual logging and weekly summary view
- [ ] 4.9 Implement productivity dashboard with charts
- [ ] 4.10 Implement suggestions panel
- [x] 4.11 Implement Serotonin Mode UI (pillars, rituals, mood, score, calm theme)
- [ ] 4.12 Integrate WebSocket client for real-time sync
- [ ] 4.13 Add IndexedDB offline storage and sync queue
- [x] 4.14 Implement onboarding tutorial for new users (guided walkthrough)
- [ ] 4.16 Implement Serotonin Detox Plan UI (onboarding, plan de inicio multi-dia, checklist diaria, progreso por fase)
## 5. Mobile app â€” Android (phase 2)

- [ ] 5.1 Scaffold Expo app with shared UI components
- [ ] 5.2 Port auth, calendar, tasks, pomodoro, fitness, and analytics screens from web
- [ ] 5.3 Implement expo-sqlite offline storage and sync queue
- [ ] 5.4 Implement push notifications for pomodoro breaks and suggestions
- [ ] 5.5 Build Android block-list picker (installed apps enumeration)
- [ ] 5.6 Implement Android Accessibility Service for app blocking during focus
- [ ] 5.7 Implement overlay UI when blocked app is opened
- [ ] 5.8 Test blocking during pomodoro, task focus, and work-hours modes

## 6. Desktop app â€” Windows (phase 3)

- [ ] 6.1 Scaffold Tauri 2 app wrapping shared React UI
- [ ] 6.2 Implement Tauri system tray with pomodoro quick controls
- [ ] 6.3 Build Rust sidecar for process blocking (configured desktop apps)
- [ ] 6.4 Implement hosts-file / DNS-based website blocking during focus
- [ ] 6.5 Implement block-list management UI for sites and desktop apps
- [ ] 6.6 Test blocking during pomodoro and work-hours on Windows
- [ ] 6.7 Implement auto-start on boot (optional, user-configurable)

## 7. Mobile â€” iOS y desktop â€” macOS (fase 6 â€” baja prioridad)

> ImplementaciÃ³n nativa en iOS y macOS pospuesta hasta completar MVP web, Android y Windows.
> En iOS/macOS el valor inicial se entrega vÃ­a web + plan de desintoxicaciÃ³n sin bloqueo profundo del SO.

- [ ] 7.1 Build iOS app from Expo with platform-adapted blocking (Screen Time API or degraded mode) â€” **baja prioridad**
- [ ] 7.2 Implement iOS pre-focus checklist and reminder notifications â€” **baja prioridad**
- [ ] 7.3 Build macOS Tauri app with NSWorkspace-based app blocking â€” **baja prioridad**
- [ ] 7.4 Test iOS degraded mode and macOS blocking flows â€” **baja prioridad**

## 8. Analytics and fitness integrations (phase 5)

- [ ] 8.1 Implement nightly BullMQ job for analytics snapshot computation
- [ ] 8.2 Integrate Apple HealthKit for iOS fitness data import â€” **baja prioridad (depende de fase 6 iOS)**
- [ ] 8.3 Integrate Google Health Connect for Android fitness data import
- [ ] 8.4 Add CSV import for fitness data on desktop
- [ ] 8.5 Enhance suggestion engine with fitness-productivity correlation insights

## 9. Polish and release

- [ ] 9.1 Implement onboarding flow explaining permissions (blocking, health, notifications)
- [ ] 9.2 Add i18n support (Spanish and English)
- [ ] 9.3 Write end-to-end tests for critical flows (task â†’ pomodoro â†’ block â†’ complete)
- [ ] 9.4 Prepare app store listings (Google Play primero; App Store iOS â€” baja prioridad) and desktop installer (Windows primero; macOS â€” baja prioridad)
- [ ] 9.5 Set up production deployment (API, database, CDN) and monitoring





