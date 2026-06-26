# Calendar API Server

NestJS + Prisma + PostgreSQL

## Setup

```bash
docker compose up -d   # from repo root
cp .env.example .env   # or set DATABASE_URL manually
npm install --legacy-peer-deps
npm run prisma:migrate
npm run dev
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | API liveness |
| GET | `/health/db` | PostgreSQL connectivity |
| POST | `/auth/register` | Create account + device session |
| POST | `/auth/login` | Email/password login |
| POST | `/auth/oauth/google` | Google ID token login |
| POST | `/auth/oauth/apple` | Apple ID token login |
| POST | `/auth/refresh` | Rotate access + refresh tokens |
| POST | `/auth/logout` | Revoke current device session (Bearer token) |
| GET | `/auth/me` | Current user profile (Bearer token) |
| GET | `/devices` | List registered devices (Bearer token) |
| POST | `/devices/register` | Register new device session (Bearer token) |
| DELETE | `/devices/:id` | Revoke another device (Bearer token) |
| GET | `/sync/pull` | Download full user snapshot (Bearer token) |
| POST | `/sync/batch` | Push offline changes with conflict resolution (Bearer token) |

WebSocket namespace: `/sync` — connect with `auth.token` = access JWT; receive `sync:changes` events.

Default port: **3000**

## Documentación API (Swagger)

Con el servidor en ejecución, abre:

**http://localhost:3000/docs**

Ahí puedes explorar todos los endpoints, ver los schemas de request/response y probar rutas autenticadas con el botón **Authorize** (pega el `accessToken` JWT).

## Schema (Prisma)

| Model | Purpose |
|-------|---------|
| `User` | Auth (email/password, Google, Apple) |
| `Device` | Registered clients + refresh token revocation |
| `Task` | Calendar tasks with difficulty, complexity, estimates |
| `Schedule` | Work/rest recurring windows by weekday |
| `PomodoroSession` | Active pomodoro state linked to tasks |
| `BlockListEntry` | Apps/sites to block (incl. high-dopamine flag) |
| `FitnessEntry` | Manual or imported exercise logs |
| `AnalyticsSnapshot` | Daily/weekly aggregated metrics + suggestions |
