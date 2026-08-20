# Mobile (Expo)

Cliente Android/iOS — fase 2 del roadmap (`openspec/changes/calendar-productivity-app/tasks.md`, sección 6).

Expo Router (managed workflow), conectado al mismo sistema de diseño (`@calendar/ui`, Tamagui) y a
la misma lógica de negocio pura (`@calendar/shared`) que usa `apps/web` — sin build step ni npm
workspaces, resueltos como fuente directa vía `metro.config.js` (mismo patrón que el
`resolve.alias` de Vite en `apps/web/vite.config.ts`; ver design.md decisión 26 para el detalle de
por qué Metro necesita más configuración que Vite para esto).

## Arrancar

```bash
npm install
npm run web      # preview rápido en el navegador, sin necesidad de emulador
npm run android  # requiere Android Studio / un emulador o dispositivo conectado
npm run ios      # requiere macOS
```

## Estado actual

Solo el scaffold (tarea 6.1): una pantalla de verificación (`src/app/index.tsx`) confirma que
`@calendar/ui` y `@calendar/shared` funcionan en este runtime. Las pantallas reales (calendario,
tareas, pomodoro, fitness, analítica) se portan en la tarea 6.2. El bloqueo real de apps
(Accessibility Service de Android) es la tarea 6.6, todavía sin diseñar.

Verificado hasta ahora solo vía `expo start --web` + Playwright (no hay SDK/emulador de Android
instalado en este entorno) — pendiente confirmar en un emulador o dispositivo Android real antes
de asumir que todo lo verificado en web se comporta igual en nativo.
