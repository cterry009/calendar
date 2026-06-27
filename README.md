# Calendar Productivity

App de productividad multiplataforma: calendario, tareas, pomodoros, analítica, fitness y **Modo Serotonina** (bienestar digital con plan de desintoxicación de 7 días).

**Web MVP** disponible. Android y escritorio en roadmap.

## Qué incluye

- Calendario, tareas con estimaciones, horarios de trabajo/descanso
- Pomodoro, dashboard de métricas y sugerencias automáticas
- Modo Serotonina: pilares, rituales, puntuación diaria y plan detox
- Sync en tiempo real (WebSocket), cola offline (IndexedDB) y lista de bloqueo
- API REST con auth JWT, sync pull/batch y Swagger en `/docs`

## Inicio rápido

```bash
# Instalar y levantar web
npm run install:all
npm run build --prefix packages/shared
docker compose up -d
npm run prisma:migrate --prefix server
npm run dev --prefix server    # API → http://localhost:3000
npm run dev --prefix apps/web  # Web → http://localhost:5173
```

> En Windows con unidad de red (`V:`), usa `npm run install:all` o `--prefix` por paquete.

Copia `server/.env.example` → `server/.env` antes de migrar.

## Tests

```bash
npm test --prefix packages/shared
npm run typecheck --prefix apps/web
npm run typecheck --prefix server
```

Smoke test (Docker + API en marcha): `powershell -NoProfile -File scripts/smoke-test.ps1`

Datos demo para dashboard: `powershell -NoProfile -File scripts/seed-dashboard-data.ps1`

## Estructura

| Ruta | Descripción |
|------|-------------|
| `apps/web` | Cliente web (Vite + React) |
| `apps/mobile` | Expo — fase 2 |
| `apps/desktop` | Tauri — fase 3 |
| `packages/shared` | Lógica compartida (Zod, pomodoro, serotonina, detox) |
| `server` | NestJS + Prisma + PostgreSQL |
| `openspec/` | Especificaciones (`calendar-productivity-app`) |

## OpenSpec

```bash
openspec status --change calendar-productivity-app
```
