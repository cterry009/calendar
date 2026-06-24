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

Default port: **3000**

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
