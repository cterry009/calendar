## Context

Proyecto greenfield. El usuario necesita una app de productividad que unifique calendario, gestión de tareas con estimación, pomodoros, bloqueo de distracciones, analítica y deporte — usable en **móvil y computador** con datos sincronizados.

Restricciones de plataforma relevantes:
- **Android**: bloqueo de apps viable con permisos de uso de apps y servicio de accesibilidad.
- **iOS**: bloqueo limitado; requiere Screen Time API y aprobación de Apple; en MVP puede ofrecer recordatorios + guía de configuración manual.
- **Escritorio (Windows/macOS)**: bloqueo de sitios (hosts/DNS local) y aplicaciones (agente nativo) es viable con permisos de administrador o helper instalado.

## Goals / Non-Goals

**Goals:**
- Experiencia unificada en Android, iOS, Windows, macOS y navegador web.
- Sincronización en tiempo casi real entre dispositivos.
- MVP funcional: calendario, tareas, horarios, pomodoros, estadísticas básicas, deporte manual.
- Bloqueo de distracciones completo en Android y escritorio; modo degradado en iOS.
- Sugerencias de mejora basadas en datos históricos del usuario.
- Modo Control de Serotonina con puntuación diaria, rituales guiados y UI de baja estimulación.

**Non-Goals (v1):**
- Integración bidireccional con Google Calendar / Outlook (solo lectura opcional en fase 2).
- Colaboración multi-usuario en tareas compartidas.
- IA generativa avanzada; las sugerencias v1 serán reglas heurísticas.
- Wearables dedicados (relojes).

## Decisions

### 1. Arquitectura: monorepo + backend centralizado

**Decisión**: Monorepo Turborepo con paquetes compartidos y API backend propia.

```
apps/
  mobile/     → React Native (Expo)
  desktop/    → Tauri 2 + React
  web/        → React (Vite), compartido con desktop
packages/
  shared/     → tipos, validación (Zod), lógica de negocio
  ui/         → componentes compartidos (Tamagui o React Native Web)
server/       → NestJS + PostgreSQL + Redis
```

**Alternativas consideradas**:
- *Flutter único*: buen cross-platform pero bloqueo nativo en escritorio requiere plugins custom complejos.
- *Solo PWA*: no permite bloqueo profundo de apps en móvil ni escritorio.

**Rationale**: React Native + Tauri maximiza código compartido y permite módulos nativos por plataforma para bloqueo.

### 2. Sincronización: backend con WebSockets

**Decisión**: PostgreSQL como fuente de verdad; Redis para presencia y cola; WebSockets (Socket.io) para sync en vivo. Offline-first en cliente con SQLite (mobile) / IndexedDB (web/desktop) y resolución por timestamp + device ID.

**Alternativas**: Firebase (vendor lock-in), CRDT puro sin servidor (complejo para analítica centralizada).

### 3. Autenticación

**Decisión**: Email + contraseña y OAuth (Google/Apple). JWT de corta duración + refresh tokens. Sesiones por dispositivo para revocación.

### 4. Bloqueo de distracciones por plataforma

| Plataforma | Mecanismo MVP |
|------------|---------------|
| Android | `UsageStatsManager` + overlay/bloqueo vía Accessibility Service |
| iOS | Screen Time API donde esté disponible; fallback: notificaciones + checklist de apps a cerrar |
| Windows | Agente Tauri: bloqueo de procesos + extensión hosts para dominios |
| macOS | Agente Tauri: `NSWorkspace` para apps + filtro de red local |
| Web | Solo recordatorios y lista de distracciones (sin bloqueo del SO) |

Lista de distracciones sincronizada desde la nube; el cliente nativo aplica las reglas localmente.

### 5. Pomodoro y foco

**Decisión**: Motor de sesiones en `packages/shared`. Estados: `idle → focus → short_break → long_break`. Disparadores: manual, inicio de tarea, horario de trabajo. Al entrar en foco, activar módulo de bloqueo de la plataforma.

### 6. Analítica y sugerencias

**Decisión**: Jobs nocturnos en servidor que calculan métricas agregadas. Sugerencias v1 por reglas:
- Estimación sistemáticamente baja/alta (>20% desviación en 5+ tareas).
- Pomodoros interrumpidos >30% en ciertos horarios.
- Días con deporte correlacionan con más tareas completadas.
- Sugerir descansos si no hay pausa en 90+ minutos de foco.

### 7. Deporte

**Decisión**: Registro manual en MVP. Fase 2: Apple HealthKit (iOS) y Google Health Connect (Android). Escritorio: entrada manual + import CSV.

### 8. Stack tecnológico concreto

| Capa | Tecnología |
|------|------------|
| Mobile | Expo SDK 52+, React Native, expo-sqlite |
| Desktop | Tauri 2, Rust sidecar para bloqueo |
| Web | Vite + React |
| UI | Tamagui (cross-platform) |
| API | NestJS, Prisma ORM |
| DB | PostgreSQL 16 |
| Cache/Queue | Redis, BullMQ |
| Auth | Passport.js + bcrypt |
| CI/CD | GitHub Actions |

### 9. Modo Control de Serotonina

**Decisión**: Modo bienestar complementario al foco/pomodoro. Basado en evidencia de que la regulación del ánimo mejora reduciendo inputs digitales de alta dopamina y aumentando actividades que apoyan la síntesis natural de serotonina (luz solar matutina, ejercicio aeróbico, conexión social, meditación, sueño).

**Componentes**:
- **Pilares de presencia** (6): outdoors/sunlight, reading, meditation, journaling, social connection, exercise.
- **Rituales guiados** (≤5 min): respiración, gratitud, estiramiento, recordatorio de luz solar, pausa digital.
- **Bloqueo extendido**: reutiliza `focus-blocking` con lista predefinida de apps/sitios de alta dopamina.
- **Puntuación diaria** (0–100): ponderación de pilares completados, rituales, check-in de ánimo y reducción de pantalla.
- **Plan de desintoxicación de inicio**: programa 7 días por defecto con fases audit → reducción selectiva → reintroducción con límites → mantenimiento; disponible en web/Android/Windows antes que clientes iOS/macOS.
- **UI calmada**: tema muted sin animaciones durante el modo activo.

**Alternativas consideradas**:
- *Dopamine fast extremo*: rechazado; la ciencia recomienda reducción selectiva, no abstinencia total ([Neurosity](https://neurosity.co/guides/dopamine-detox-science-vs-myth), [MindLab](https://mindlabneuroscience.com/dopamine-and-mood-swings-neuroscience/)).
- *Solo tracker de ánimo*: insuficiente; el valor está en acción guiada + bloqueo + métricas.

### 10. Navegación de una sola pestaña

**Decisión**: El Calendario (ya hub desde la tarea 4.17) queda como única vista de fondo. Dashboard, Sugerencias, Pomodoro, Bloqueo, Fitness y Detox se abren como paneles deslizantes desde iconos en `AppNav.tsx`, sin cambiar de ruta ni ocultar el calendario detrás.

**Alternativas consideradas**:
- *Rail lateral de iconos que sigue navegando por rutas completas* (estilo Notion/Linear colapsado): descartado porque el calendario deja de estar visible al entrar a otra sección, que es justo lo que se quiere evitar.
- *Dock flotante inferior*: mismo comportamiento de panel deslizante que la opción elegida, pero introduce un elemento de chrome nuevo; se prefiere reutilizar el header (`AppNav.tsx`) que ya existe.

**Rationale**: mantiene "una sola pestaña" real (el calendario nunca se desmonta), reduce el chrome nuevo a crear, y es el patrón de apps modernas (Superhuman, Linear, Notion peek) que el usuario pidió explícitamente.

### 11. Sonido ambiental de enfoque

**Decisión**: Integración con Spotify (OAuth Authorization Code + PKCE, mismo patrón que Google/Apple en `auth/oauth.service.ts`) como opción principal para playlists de concentración, con sonidos ambientales propios (lluvia, ruido blanco, lofi) como respaldo sin cuenta. El widget de reproducción se engancha al estado de foco ya existente (`isPomodoroBlocking`/`manualSoftFocus.active`/`isWorkHoursActive`) para auto-play/pausa.

**Alternativas consideradas**:
- *Solo Spotify*: descartado — el Web Playback SDK de Spotify requiere cuenta Premium, lo que dejaría sin sonido ambiental a una parte significativa de usuarios.

**Riesgo documentado**: reproducción in-app vía Web Playback SDK solo funciona con Spotify Premium; los sonidos propios cubren ese hueco.

### 12. Entrenamiento cognitivo tipo BrainHQ — descartado

**Decisión**: no construir esta feature. Entrena *capacidad* perceptual-cognitiva (velocidad de procesamiento, memoria de trabajo, atención), no disciplina/hábito, que es lo que este proyecto busca. El modelo de "fuerza de voluntad como recurso entrenable" (ego depletion) tampoco replicó en réplicas grandes preregistradas (Hagger et al. 2016, N=2,141; Dang et al. 2019, N=3,531), así que no hay un sustituto válido de este tipo para "entrenar disciplina". La construcción de disciplina de esta app ya vive en 5.2 (planificación si-entonces) y en 5.6/5.7 (hard mode / friction overlay), que sí tienen evidencia detrás.

### 13. Modo Serotonina y Plan de Detox: siempre activos, no funciones opt-in

**Decisión**: ni el Modo Control de Serotonina (pilares, rituales, check-in de ánimo) ni el Plan de desintoxicación de 7 días requieren un botón de activación. Ambos arrancan solos — el Modo Serotonina con una sesión nueva cada día (persistida localmente en IndexedDB, ver `apps/web/src/lib/offline/serotonin-store.ts`), el Plan de Detox con el día 1 en cuanto se detecta que el usuario no tiene un plan en curso (`useDetoxPlan.ts`).

**Rationale**: el enfoque de reducir dependencia de estímulos de alta dopamina debe ser innato al usar la app, no una opción aparte que el usuario tiene que recordar prender — un "modo" que hay que activar es exactamente el patrón opt-in que se quería evitar.

**Límite conocido, fuera de alcance de esta decisión**: el flag `highDopamine` en las entradas de la lista de bloqueo (`BlockListEntry`) hoy solo se muestra como etiqueta informativa (`BlockListItem.tsx`) — no activa ningún bloqueo real distinto del resto de la lista. Un bloqueo permanente (no solo durante pomodoro/horario de trabajo/foco manual) requeriría bloqueo real a nivel de sistema operativo en apps de terceros, que es trabajo de fase 6/7 (Android/Windows) todavía no construido; `SoftFocusOverlay` bloquea toda la pantalla de la app y no es el mecanismo correcto para dejarlo permanentemente activo.

### 14. Modo estricto (`hardMode`) en la lista de bloqueo (tarea 5.6)

**Decisión**: `BlockListEntry` gana un campo `hardMode: boolean`, especificado ahora para que Android (6.6) y Windows (7.3) implementen el mismo comportamiento en vez de divergir cada uno por su cuenta: una entrada en modo estricto no se puede desactivar ni eliminar sin una confirmación explícita y separada del flujo normal de edición/borrado.

Como todavía no existe bloqueo real a nivel de sistema operativo (eso es 6.6/7.3, no construido), el cumplimiento en la web hoy es fricción sobre la propia entrada, no bloqueo de terceros: `BlockListForm` exige un `confirm()` adicional antes de guardar un cambio que apague `hardMode` o `enabled` en una entrada que ya estaba en modo estricto, y `BlockListItem` usa un mensaje de confirmación más fuerte al eliminar una entrada en modo estricto. Este es el contrato que las apps nativas deben replicar cuando se construyan: "modo estricto" siempre implica un paso de confirmación explícito e independiente para desactivar o eliminar, nunca un solo toque.

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| [iOS bloqueo limitado] | Documentar limitaciones; ofrecer valor con pomodoros + recordatorios; solicitar entitlement Screen Time en fase 2 |
| [Permisos invasivos en Android/desktop] | Onboarding claro explicando por qué; bloqueo solo durante foco explícito |
| [Complejidad multiplataforma] | MVP Web + Android + Windows primero; **iOS y macOS en fase 6 (baja prioridad)** |
| [Sincronización offline] | Cola local de cambios; conflictos: last-write-wins en campos simples, merge manual en tareas |
| [Batería en móvil por monitoreo de apps] | Activar servicio solo durante sesiones de foco activas |
| [Seguridad datos de salud] | Cumplir mínimos de privacidad; no compartir datos fitness con terceros en v1 |

## Migration Plan

No aplica (proyecto nuevo). Despliegue por fases:

1. **Fase 1**: Backend + Web (calendario, tareas, pomodoros, stats básicas, **modo serotonina**, **plan de desintoxicación**).
2. **Fase 2**: App Android + bloqueo Android + sync completo.
3. **Fase 3**: Desktop Windows (Tauri + bloqueo).
4. **Fase 5**: Integraciones Health/Fit y sugerencias avanzadas.
5. **Fase 6 (baja prioridad)**: iOS + macOS — clientes nativos con bloqueo adaptado o modo degradado.

## Open Questions

- ¿Nombre comercial de la app? (afecta branding y stores)
- ¿Modelo freemium o pago único? (bloqueo avanzado podría ser premium)
- ¿Prioridad Windows vs macOS para escritorio? → **Windows primero; macOS fase 6 (baja prioridad)**
- ¿Idioma inicial solo español o i18n desde v1?
