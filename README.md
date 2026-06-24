# Calendar Productivity

App de calendario multiplataforma con pomodoros, bloqueo de distracciones, analítica, deporte y **Modo Control de Serotonina**.

## Modo Serotonina

Basado en evidencia de bienestar digital y neurociencia:

- Reduce inputs digitales de alta dopamina (bloqueo en móvil/escritorio)
- Promueve 6 pilares: luz solar, lectura, meditación, journaling, conexión social, ejercicio
- Rituales guiados ≤5 min (respiración, gratitud, estiramiento, luz, pausa digital)
- Puntuación diaria 0–100 y check-in de ánimo

Referencias: [Harvard Health — Serotonin](https://www.health.harvard.edu/mind-and-mood/serotonin-the-natural-mood-booster), [PMC — exercise & serotonin](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2077351/), [Neurosity — dopamine detox science](https://neurosity.co/guides/dopamine-detox-science-vs-myth)

## Desarrollo

```bash
npm install --prefix packages/shared
npm install --prefix packages/ui --legacy-peer-deps
npm install --prefix apps/web --legacy-peer-deps
npm run build --prefix packages/shared
npm run dev --prefix apps/web
```

> **Nota Windows:** si el proyecto está en una unidad de red (p. ej. `V:`), npm workspaces puede fallar por symlinks. Usa `--prefix` por paquete como arriba, o `npm run install:all` desde la raíz.

Docker (PostgreSQL + Redis):

```bash
docker compose up -d
```

API server:

```bash
npm install --prefix server --legacy-peer-deps
cp server/.env.example server/.env
npm run dev --prefix server
```

## Estructura

```
apps/web      → MVP web (Vite + React)
apps/mobile   → Expo (fase 2)
apps/desktop  → Tauri (fase 3)
packages/shared → lógica compartida (serotonina, pomodoros, etc.)
server/        → NestJS API (Prisma + PostgreSQL)
openspec/     → especificaciones y cambios
```

## OpenSpec

Cambio activo: `calendar-productivity-app`

```bash
openspec status --change calendar-productivity-app
```
