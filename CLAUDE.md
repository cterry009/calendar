# CLAUDE.md

Productivity calendar for one user across devices: tasks, work/rest schedule blocks, pomodoros,
distraction blocking, habits, fitness/steps, screen and game time, analytics, AI week planning, and
"Modo Serotonina" (a 7-day digital detox). Android phone + Windows desktop + web, all talking to
one NestJS API. `README.md` (Spanish) has the full setup and command tables; this file covers what
you need to work in the code.

## Layout

| Path | What it is |
|------|------------|
| `server/` | NestJS 11 + Prisma 6 + PostgreSQL API, Socket.IO gateway. Port 3000, Swagger at `/docs` |
| `apps/web/` | Vite + React 18 + Tamagui + React Router. Port 5173. Also the desktop app's UI |
| `apps/desktop/` | Tauri 2 shell around `apps/web` (Rust in `src-tauri/src/`: tray, process/site blocking via hosts file, app/game/website time tracking) |
| `apps/mobile/` | Expo (SDK 57) + Expo Router, Android-first. Native Kotlin modules in `modules/` (`focus-block` accessibility-service blocker, `screen-time`, `step-tracking`, `activity-recognition`) |
| `packages/shared/` | Pure business logic + Zod schemas (pomodoro state machine, analytics, detox, attention profiles, habits score, study planning). Jest tests live here |
| `packages/ui/` | Tamagui config, tokens, shared components |
| `services/laya/` | Optional local Python model server (port 8100) that scores task complexity for the planner |
| `openspec/changes/calendar-productivity-app/` | The spec: `proposal.md`, `design.md` (numbered decisions), `specs/`, and `tasks.md` (the roadmap; commits and comments cite its task numbers, e.g. "task 8.13") |
| `docs/planning/` | Attention rubric and AI planning flow (Spanish), read by the server's planner |
| `scripts/` | Smoke test / dashboard seed (PowerShell), study-notes importer and study-status exporter (writes `Estado_estudio.md`/`.json` into the vault), icon generator |

## No npm workspaces

Each package has its own `node_modules` and lockfile; install with `npm run install:all` (uses
`--legacy-peer-deps`). Root `turbo` scripts exist but per-package `--prefix` commands are what CI
and the README use.

`@calendar/shared` and `@calendar/ui` are consumed **as TypeScript source**, not as built packages:
`apps/web/vite.config.ts` aliases them and `apps/mobile/metro.config.js` resolves them (and forces
single copies of react/tamagui — duplicate Tamagui instances cause "Missing theme" / null `.map`
crashes; read those files' comments before touching resolution). Shared source uses NodeNext-style
`./foo.js` relative imports; keep that. Only `scripts/import-study-notes.mjs` and
`scripts/export-study-status.mjs` need `npm run build:shared` first. The server does not import `@calendar/shared`.

## Commands

```bash
docker compose up -d                       # Postgres 16 (calendar/calendar/calendar) + Redis 7
npm run dev:server                         # nest start --watch on :3000
npm run dev --prefix apps/web              # Vite on :5173
npm run dev --prefix apps/desktop          # tauri dev (starts web's Vite itself; stop any other :5173 first)
npm run android --prefix apps/mobile       # build + install + run on device/emulator
npx expo start --port 8081                 # (in apps/mobile) Metro only, for JS-only iteration

npm run test --prefix packages/shared      # Jest
npm run test --prefix apps/web             # Vitest
npm run test --prefix server               # Vitest integration tests, needs Postgres up
npm run typecheck --prefix <pkg>           # shared, ui, server, apps/web, apps/mobile
npm run prisma:migrate --prefix server     # prisma migrate dev
npm run seed --prefix server               # dev user from server/.env.dev-user (gitignored)
```

Single test: `npx vitest run test/sync.service.test.ts` (server) or
`npx vitest run src/lib/tasks` (web); shared: `npm test --prefix packages/shared -- <pattern>`.

CI (`.github/workflows/ci.yml`) runs: ui/shared typecheck, shared tests + build, web
typecheck/test/build, server build. It does not run server tests, mobile, or desktop.

Server env: copy `server/.env.example` to `server/.env`. `GEMINI_API_KEY` and `LAYA_URL` are
optional; without them planning falls back to the heuristic planner / stored complexity and says
so in the proposal's `warnings`.

## Architecture

**Sync is the backbone.** Every client keeps a full local snapshot and an offline queue:

- `GET /sync/pull` returns the user's whole snapshot (block events limited to 30 days, schedule
  completions to 60).
- `POST /sync/batch` pushes queued changes per entity; the response splits `applied` and
  `conflicts`. Default rule is updatedAt-wins (`isServerNewer`), but several entities differ on
  purpose — daily step/floor counts merge by `max()` keyed on (userId, date); block and focus
  events are immutable idempotent creates on the client id; schedule completions and habit
  records are idempotent on their natural unique keys. The reasoning is in comments above each
  `apply*Change` in `server/src/sync/sync.service.ts`.
- After a batch, `SyncEventsService` emits `sync:changes` on the `/sync` Socket.IO namespace
  (auth with the access JWT) so other devices re-pull.
- Web: `apps/web/src/lib/offline/` (IndexedDB) + `context/SyncContext.tsx`. Mobile:
  `apps/mobile/src/lib/offline/db.ts` (expo-sqlite) + `lib/sync/api.ts`, ported from the web.

Adding a synced entity touches: `server/prisma/schema.prisma` + a migration,
`server/src/sync/sync.types.ts`, `dto/sync-batch.dto.ts`, `sync.service.ts` (pull + an apply
method), `server/test/sync.service.test.ts`, a Zod schema in `packages/shared/src/schemas/`, and
each client's snapshot types (`lib/calendar/types.ts`), offline types/conflicts and sync code.
Clients default missing snapshot fields (`?? []`) because cached snapshots predate new entities.

**Server modules** (`server/src/`): `auth` (email/password, Google/Apple ID tokens, JWT access +
per-device refresh tokens), `devices`, `sync`, `realtime`, `planning`, `prisma`. Global
`ValidationPipe` uses `whitelist` + `forbidNonWhitelisted`, so every accepted field needs a
class-validator decorator on its DTO. JSON body limit is 10mb for large offline flushes. In
development each request logs an `[http] METHOD url status ms ip` line.

**Planning** (`server/src/planning/`): `POST /planning/propose` builds free slots from schedules,
asks Gemini (`gemini-planner.ts`, model fallback list in `GEMINI_MODEL`) or the
`heuristic-planner.ts`, then `plan-validator.ts` enforces the hard rules. Models classify and
propose; code decides minutes, capacity and order; the user approves. See
`docs/planning/flujo-ia.md`.

**Desktop** loads `http://localhost:5173` in dev and `apps/web/dist` in production; web code
detects Tauri and dynamic-imports `@tauri-apps/api` (`apps/web/src/lib/desktop/`,
`components/desktop/*Bridge.tsx`).

## Conventions

- TypeScript strict. Prettier: single quotes, semicolons, trailing commas, width 100.
- UI is Spanish first. Web strings go through `apps/web/src/i18n/dictionaries/` (`es` default,
  `en`); mobile strings are mostly inline Spanish.
- Comments explain *why*, often with the date or task number of the bug that motivated them.
  Match that density when editing nearby code; don't strip existing ones.
- Server tests hit a real Postgres database `calendar_test` (derived from `DATABASE_URL`,
  migrated by `test/global-setup.ts`, files run serially) — no Prisma mocks.
- Commits: conventional commits (`feat:`, `fix:`, `feat(mobile):`, `docs(tasks):`) with plain
  user-facing subjects; mention the `tasks.md` number when there is one, and update `tasks.md`
  when finishing a task.
- `apps/mobile/android/` is generated by `npx expo prebuild -p android` and not committed; rerun
  it after changing native modules, permissions, `app.json` or `plugins/`. Read the Expo v57
  docs before writing mobile code (`apps/mobile/AGENTS.md`).
- Spec-driven changes use the OpenSpec skills/commands in `.claude/` (`/opsx:propose`,
  `/opsx:apply`, ...).

## Gotchas

- Nothing starts the API or Docker automatically. A client showing "Sin conexión" usually means
  Docker Desktop or the Nest server is down, not an app bug. The phone and desktop reach the API
  over the LAN on port 3000 (USB device: `adb reverse tcp:3000 tcp:3000` and `tcp:8081`).
- `prisma generate` fails with EPERM while the server is running (locked query-engine DLL): stop
  the server first.
- The dev database also holds many automated test accounts. Filter every diagnostic query by
  `"userId"` and never bulk-delete without that filter.
- Android: don't restart the app with `adb shell am crash` or `am force-stop` — it leaves
  `FocusBlockAccessibilityService` unbound/"crashed" and blocking silently stops. `adb install -r`
  can do the same. Relaunch with
  `adb shell monkey -p app.calendarproductivity.mobile -c android.intent.category.LAUNCHER 1` and
  check `adb shell dumpsys accessibility` after installs.
- Windows Controlled Folder Access can make Node builds fail with `ENOENT`/`EBADF` (fix in
  README).
