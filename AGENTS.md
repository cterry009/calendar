# AGENTS.md

## Cursor Cloud specific instructions

Monorepo for a cross-platform calendar/productivity app. Relevant components:

- `packages/shared` — shared TS logic (serotonin, pomodoro, analytics). Tested with Jest.
- `packages/ui` — Tamagui UI components (typecheck/lint only).
- `apps/web` — Vite + React MVP web app (the primary runnable product). Talks to the API.
- `server` — NestJS API (Prisma + PostgreSQL). Redis is in `docker-compose.yml` but is **not** used by the server code; only PostgreSQL is required.
- `apps/mobile` (Expo) and `apps/desktop` (Tauri) are unimplemented stubs — their `dev`/`build` scripts just `echo` placeholders. No setup needed.

### Service startup (deps already installed by the update script)

PostgreSQL is provided natively (apt), not Docker, in this environment. Start it and ensure the `calendar` role/DB exist before running the server:

```bash
sudo pg_ctlcluster 16 main start
# one-time (idempotent): create role+db matching server/.env DATABASE_URL
sudo -u postgres psql -c "CREATE USER calendar WITH PASSWORD 'calendar' CREATEDB;" 2>/dev/null
sudo -u postgres psql -c "CREATE DATABASE calendar OWNER calendar;" 2>/dev/null
```

Server (`http://localhost:3000`, Swagger at `/docs`):

```bash
cp -n server/.env.example server/.env          # defaults already point at the local DB
cd server && npx prisma migrate deploy && cd .. # run migrations (deploy, not dev, in CI/cloud)
npm run dev --prefix server                     # NestJS watch mode
```

Web (`http://localhost:5173`):

```bash
npm run dev:web   # builds packages/shared then runs Vite. Defaults VITE_API_URL to http://localhost:3000
```

### Gotchas

- **Root turbo scripts are broken.** Root `package.json` has no `workspaces` field, so `npm run dev|build|lint|test|typecheck` (which call `turbo run ...`) loop/recurse and fail. Use the per-package `--prefix` commands (matches `.github/workflows/ci.yml` and README) instead.
- **Prisma needs `.env` in CWD.** Run prisma commands from `server/` (or `--prefix server`) so it loads `server/.env`; running from the repo root fails with `Environment variable not found: DATABASE_URL`.
- All installs use `--legacy-peer-deps` (configured in `.npmrc`). Use `npm run install:all` from root, which installs each package; root dev deps (turbo/eslint) require a separate `npm install` at root.
- `apps/web` register payload uses field `name` (not `displayName`) plus required `deviceLabel` + `devicePlatform` (e.g. `WEB`).
- Pre-existing lint errors exist in `apps/web` (unused vars in `src/lib/analytics/aggregate.ts` and `src/vite-env.d.ts`); they are not caused by environment setup.
