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
