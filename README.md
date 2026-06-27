# Calendar Productivity

App de calendario multiplataforma con pomodoros, bloqueo de distracciones, analÃ­tica, deporte y **Modo Control de Serotonina**.

## Modo Serotonina

Basado en evidencia de bienestar digital y neurociencia:

- Reduce inputs digitales de alta dopamina (bloqueo en mÃ³vil/escritorio)
- Promueve 6 pilares: luz solar, lectura, meditaciÃ³n, journaling, conexiÃ³n social, ejercicio
- Rituales guiados â‰¤5 min (respiraciÃ³n, gratitud, estiramiento, luz, pausa digital)
- PuntuaciÃ³n diaria 0â€“100 y check-in de Ã¡nimo

Referencias: [Harvard Health â€” Serotonin](https://www.health.harvard.edu/mind-and-mood/serotonin-the-natural-mood-booster), [PMC â€” exercise & serotonin](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2077351/), [Neurosity â€” dopamine detox science](https://neurosity.co/guides/dopamine-detox-science-vs-myth)

## Desarrollo

```bash
npm install --prefix packages/shared
npm install --prefix packages/ui --legacy-peer-deps
npm install --prefix apps/web --legacy-peer-deps
npm run build --prefix packages/shared
npm run dev --prefix apps/web
```

> **Nota Windows:** si el proyecto estÃ¡ en una unidad de red (p. ej. `V:`), npm workspaces puede fallar por symlinks. Usa `--prefix` por paquete como arriba, o `npm run install:all` desde la raÃ­z.

Docker (PostgreSQL + Redis):

```bash
docker compose up -d
```

API server:

```bash
npm install --prefix server --legacy-peer-deps
cp server/.env.example server/.env
npm run prisma:migrate --prefix server
npm run dev --prefix server
```

DocumentaciÃ³n interactiva: **http://localhost:3000/docs** (Swagger UI)

## Tests

### Tests unitarios y builds

Desde la raÃ­z del repo:

```bash
# LÃ³gica compartida (Jest)
npm test --prefix packages/shared

# Builds / typecheck
npm run build --prefix packages/shared
npm run typecheck --prefix packages/ui
npm run build --prefix apps/web
npm run typecheck --prefix server
npm run build --prefix server
```

O instala todo de una vez:

```bash
npm run install:all
```

### Smoke test de la API

Requiere **Docker Desktop** en ejecuciÃ³n (PostgreSQL + Redis) y el servidor API levantado.

```bash
# 1. Base de datos
docker compose up -d

# 2. Migraciones (primera vez o tras cambios de schema)
npm run prisma:migrate --prefix server

# 3. Servidor (otra terminal)
npm run start --prefix server

# 4. Smoke test â€” auth, devices, sync
powershell -NoProfile -File scripts/smoke-test.ps1
```

El script verifica:

| Endpoint | QuÃ© prueba |
|----------|------------|
| `GET /health` | API viva |
| `GET /health/db` | ConexiÃ³n PostgreSQL |
| `POST /auth/register` | Registro (requiere `deviceLabel` + `devicePlatform`) |
| `POST /auth/login` | Login |
| `GET /auth/me` | Perfil con JWT |
| `POST /devices/register` | Registro de dispositivo |
| `GET /devices` | Listado de dispositivos |
| `POST /auth/refresh` | RotaciÃ³n de refresh token |
| `GET /sync/pull` | Snapshot de sync |
| `POST /sync/batch` | CreaciÃ³n de tarea offline |

Si el smoke test falla con `Can't reach database server`, asegÃºrate de que Docker estÃ© corriendo y que `server/.env` tenga el `DATABASE_URL` correcto (ver `server/.env.example`).

### Seed de datos demo para dashboard

Con API levantada, puedes poblar 14 dias de datos de tareas/pomodoros/fitness para `/dashboard`:

```powershell
powershell -NoProfile -File scripts/seed-dashboard-data.ps1
```

Opciones utiles:

- Usar token existente: `-AccessToken <jwt>` o variable `CALENDAR_ACCESS_TOKEN`.
- Reusar usuario: define `CALENDAR_DEMO_EMAIL` y `CALENDAR_DEMO_PASSWORD` (si existe, el script cae a login).
## Estructura

```
apps/web      â†’ MVP web (Vite + React)
apps/mobile   â†’ Expo (fase 2)
apps/desktop  â†’ Tauri (fase 3)
packages/shared â†’ lÃ³gica compartida (serotonina, pomodoros, etc.)
server/        â†’ NestJS API (Prisma + PostgreSQL)
openspec/     â†’ especificaciones y cambios
```

## OpenSpec

Cambio activo: `calendar-productivity-app`

```bash
openspec status --change calendar-productivity-app
```


