# Calendar Productivity

App de productividad multiplataforma: calendario, tareas, pomodoros, analítica, fitness y **Modo Serotonina** (bienestar digital con plan de desintoxicación de 7 días).

**Web** y **Android** disponibles (bloqueo real de apps, hábitos, sensores, tiempo de pantalla).
Escritorio (Windows) en roadmap.

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

### 8. (Opcional) Iniciar la app de Android

Ver la sección [Mobile (Android)](#mobile-android) más abajo — necesita el servidor (paso 6)
corriendo y, si es un dispositivo físico por USB, un paso extra de `adb reverse`.

---

## Mobile (Android)

Requiere, además de lo del resto del proyecto: **Android SDK** + **JDK 17**, `adb` en el `PATH`, y
un emulador o un dispositivo físico con **depuración USB** activada. `apps/mobile/android/` es
generado (`expo prebuild`) y no se versiona en git.

### Primera vez / después de cambiar código nativo (Kotlin, permisos, `app.json`)

```bash
cd apps/mobile
npx expo prebuild -p android
```

### Arrancar (con el server del paso 6 ya corriendo)

**Opción rápida — todo en un comando** (compila, instala y abre la app; arranca Metro solo):

```bash
npm run android --prefix apps/mobile
```

**Opción manual — más control, recomendada si ya estás iterando** (deja Metro corriendo en su
propia terminal en vez de reconstruir el APK en cada cambio de JS):

```bash
# Terminal 1: Metro (bundler de JS) -- dejar corriendo
npx expo start --port 8081 --prefix apps/mobile

# Terminal 2, solo la primera vez o tras un cambio nativo: compilar e instalar
cd apps/mobile/android
./gradlew.bat assembleDebug          # PowerShell/cmd; en Git Bash: ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk

# Si el dispositivo está conectado por USB (no hace falta en emulador):
adb reverse tcp:8081 tcp:8081        # para llegar a Metro
adb reverse tcp:3000 tcp:3000        # para llegar al server local

adb shell am start -n app.calendarproductivity.mobile/.MainActivity
```

Un cambio de solo JS/TS se recarga solo vía Metro (no hace falta repetir `gradlew`/`adb install`);
un cambio en Kotlin (`apps/mobile/modules/*`) o en el manifest sí requiere recompilar.

Ver `adb devices` para confirmar que el dispositivo/emulador está conectado.

---

## Comandos

### Desarrollo

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Web + server en paralelo (Turborepo) |
| `npm run dev:web` | Dev server de la web (Vite) |
| `npm run dev:server` | Dev server del API (NestJS con watch) |
| `npm run dev:mobile` | Preview de mobile en el navegador (`expo start --web`, sin emulador) |
| `npm run android --prefix apps/mobile` | Compila, instala y abre la app en Android (ver [Mobile (Android)](#mobile-android)) |
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

## Cerrar todo

Si arrancaste cada proceso (server, web, Metro) con `&` / en segundo plano y `Ctrl+C` no alcanza
para cortarlos, la forma confiable en Windows es matar el árbol de procesos por PID.

### 1. Encontrar los PIDs

```powershell
wmic process where "name='node.exe'" get ProcessId,CommandLine
```

Vas a ver una línea por proceso `node.exe` corriendo. Identificalos por el comando: el que dice
`nest.js start --watch` es el server, el que dice `vite.js` es la web, el que dice
`expo...start --port 8081` es Metro.

### 2. Matar cada árbol de procesos

```powershell
taskkill /F /T /PID <pid-del-server>
taskkill /F /T /PID <pid-de-la-web>
taskkill /F /T /PID <pid-de-metro>
```

`/T` mata también los procesos hijos (necesario: el PID de `npm run dev` no es el mismo que el del
proceso real que quedó escuchando el puerto).

### 3. Parar la base de datos y el cache

```bash
docker compose stop
```

Detiene los contenedores sin borrarlos -- `docker compose up -d` los vuelve a levantar tal cual
quedaron. Usar `docker compose down` en vez de `stop` solo si además querés borrar los contenedores
(los datos persisten igual mientras no se borre también el volumen).

### Todo junto, de una

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'nest\.js start|vite\.js|expo.*start' } |
  ForEach-Object { taskkill /F /T /PID $_.ProcessId }
docker compose stop
```

Encuentra y mata automáticamente el server, la web y Metro (si están corriendo), y para Docker --
sin tener que buscar los PIDs a mano. Si además hay un dispositivo Android conectado, el `adb
reverse` que hayas configurado no hace falta deshacerlo (se limpia solo al desconectar el USB).

## Notas para Windows

Si ves errores `ENOENT` o `EBADF` al compilar, **Windows Controlled Folder Access** está bloqueando a Node.js. Solución:

```powershell
Add-MpPreference -ControlledFolderAccessAllowedApplications "C:\Program Files\nodejs\node.exe"
```

## Estructura

| Ruta | Descripción |
|------|-------------|
| `apps/web` | Cliente web (Vite + React + Tamagui) |
| `apps/mobile` | Expo Router (Android) — ver [Mobile (Android)](#mobile-android) |
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
