# Calendar Productivity

App de productividad multiplataforma: calendario, tareas, pomodoros, analítica, fitness y **Modo Serotonina** (bienestar digital con plan de desintoxicación de 7 días).

**Web MVP** disponible. Android y escritorio en roadmap.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Vite + React + Tamagui + React Router |
| Backend | NestJS + Prisma + WebSockets |
| Base de datos | PostgreSQL 16 |
| Cache | Redis 7 |
| Sync | Socket.IO con cola offline y pull/batch REST |

## Requisitos

- **Node.js** >= 20
- **Docker** (para PostgreSQL y Redis)

## Inicio rápido

### 1. Configurar variables de entorno

```bash
cp server/.env.example server/.env
```

### 2. Instalar dependencias

```bash
npm run install:all
```

Instala dependencias en todos los paquetes: `packages/shared`, `packages/ui`, `apps/web`, `server`.

### 3. Construir el paquete compartido

```bash
npm run build:shared
```

Compila TypeScript de `packages/shared` a `dist/`. Necesario para que la web y el server puedan importarlo.

### 4. Levantar base de datos y cache

```bash
docker compose up -d
```

Inicia **PostgreSQL** (puerto `5432`) y **Redis** (puerto `6379`) en contenedores Docker.

### 5. Ejecutar migraciones

```bash
npm run prisma:migrate --prefix server
```

Crea las tablas en PostgreSQL (`users`, `tasks`, `pomodoro_sessions`, `fitness_entries`, etc.).

### 6. Iniciar el servidor

```bash
npm run dev:server
```

Arranca la API REST en `http://localhost:3000` con recarga automática.
Swagger en `http://localhost:3000/docs`.

### 7. Iniciar la web

```bash
npm run dev:web
```

Arranca Vite en `http://localhost:5173` con Hot Module Replacement.

---

## Comandos

### Desarrollo

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Web + server en paralelo (Turborepo) |
| `npm run dev:web` | Dev server de la web (Vite) |
| `npm run dev:server` | Dev server del API (NestJS con watch) |
| `npm run build:shared` | Compila `packages/shared` |
| `npm run lint` | ESLint en todos los paquetes |

### Tests

| Comando | Qué hace |
|---------|----------|
| `npm run test --prefix packages/shared` | Tests unitarios del paquete compartido |
| `npm run typecheck --prefix packages/shared` | Type check del paquete compartido |
| `npm run typecheck --prefix server` | Type check del servidor |
| `npm run typecheck --prefix apps/web` | Type check de la web |

### Base de datos

| Comando | Qué hace |
|---------|----------|
| `docker compose up -d` | Levanta PostgreSQL + Redis |
| `docker compose down` | Detiene los contenedores |
| `npm run prisma:migrate --prefix server` | Ejecuta migraciones |
| `npm run prisma:studio --prefix server` | Prisma Studio (UI para ver/editar datos) |
| `npm run prisma:generate --prefix server` | Regenera el cliente Prisma |

### Scripts (requieren server corriendo)

| Comando | Qué hace |
|---------|----------|
| `powershell -File scripts/smoke-test.ps1` | Registra usuario aleatorio y prueba login |
| `powershell -File scripts/seed-dashboard-data.ps1` | Crea usuario demo con datos de dashboard |

---

## Notas para Windows

Si ves errores `ENOENT` o `EBADF` al compilar, **Windows Controlled Folder Access** está bloqueando a Node.js. Solución:

```powershell
Add-MpPreference -ControlledFolderAccessAllowedApplications "C:\Program Files\nodejs\node.exe"
```

## Estructura

| Ruta | Descripción |
|------|-------------|
| `apps/web` | Cliente web (Vite + React + Tamagui) |
| `apps/mobile` | Expo — fase 2 |
| `apps/desktop` | Tauri — fase 3 |
| `packages/shared` | Lógica compartida (Zod, pomodoro, serotonina, detox) |
| `packages/ui` | Componentes UI compartidos |
| `server` | API NestJS + Prisma + PostgreSQL |
| `scripts/` | Smoke test y seed de datos |
| `openspec/` | Especificaciones del proyecto |

## API

Documentación interactiva en `http://localhost:3000/docs` (con server corriendo).

Endpoints principales:

- `POST /auth/register` — Registro
- `POST /auth/login` — Login
- `GET /sync/pull` — Pull de datos
- `POST /sync/batch` — Batch sync
