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

### 15. Overlay de fricción compartido (tarea 5.7)

**Decisión**: un único componente `FrictionOverlay` (`apps/web/src/components/friction/FrictionOverlay.tsx`) implementa la pausa de respiración 4-7-8 (animación circular + texto de fase/cuenta regresiva) con la acción principal deshabilitada hasta completar el número de ciclos configurado. Se reutiliza en dos puntos existentes en vez de crear un mecanismo nuevo por caso de uso:

1. **Salida de `SoftFocusOverlay` durante un pomodoro activo**: el botón "Salir del enfoque" abría antes un `window.confirm()` — una interrupción abrupta de un solo clic. Ahora abre el `FrictionOverlay` (2 ciclos, ~38s); el usuario puede "Volver al enfoque" en cualquier momento, o esperar la pausa y confirmar la salida. Es la alternativa "más suave" a la que se refiere la tarea: mismo resultado final (cancelar el pomodoro), pero sin el corte abrupto de un diálogo nativo.
2. **Ritual "Respiración 4-7-8" de Modo Serotonina**: antes se completaba con un solo toque en "Completar" sin ninguna espera real, pese a describir "4 ciclos" de respiración. Ahora corre el `FrictionOverlay` real con 4 ciclos (~76s) y solo entonces permite marcarlo como completo.

**Límite conocido**: la tarea también menciona "la intervención de detox-serotonina al abrir una app de alta dopamina" — eso implicaría interceptar la apertura de una app o sitio de terceros, que requiere bloqueo real a nivel de sistema operativo (fase 6/7, no construida). El equivalente disponible hoy en la web es el punto 2 de arriba: el mismo componente sirve como la intervención real cuando el usuario decide iniciar la pausa de respiración desde Modo Serotonina. `BlockListEntry.highDopamine` sigue sin gatillar nada automáticamente (ver decisión 13); conectar el `FrictionOverlay` a una apertura real de apps de alta dopamina es trabajo de 6.7/7.6.

### 16. Condiciones de activación por ubicación y Wi-Fi (tarea 5.8)

**Decisión**: nuevo modelo `FocusTrigger` (independiente de `BlockListEntry`, ya que lo que activa el bloqueo hoy — pomodoro/foco manual/horario de trabajo — vive en `SoftFocusContext`, no en las entradas de la lista) con dos tipos:

- **LOCATION**: se aplica de verdad en la web. `SoftFocusContext` observa `navigator.geolocation.watchPosition` mientras haya al menos una condición de ubicación activa, y calcula distancia con la fórmula de haversine (`packages/shared/src/geo/distance.ts`, testeada) contra cada condición guardada. Si el usuario está dentro del radio configurado, se suma a `isOverlayVisible` igual que un pomodoro o un horario de trabajo, con su propio botón de salida ("Salir del enfoque" en `SoftFocusOverlay`, que llama a `dismissLocationFocus()` y se resetea al salir del radio, igual que el patrón ya usado para horarios de trabajo). Es enforcement real de foreground: requiere permiso de geolocalización y la pestaña abierta — no hay geofencing en segundo plano sin Service Worker + Background Sync, fuera de alcance aquí.
- **WIFI**: los navegadores no exponen el SSID de la red conectada a JavaScript por diseño (privacidad) — no existe ninguna API web para esto. La condición se guarda igual (mismo modelo, mismo formulario) pero no activa nada en la web; tanto el formulario como la tarjeta de la lista muestran una advertencia explícita de que la detección real requiere las apps nativas de Android/Windows (6.6/7.3). Mismo patrón que `hardMode` en la decisión 14: especificar el dato ahora para que las apps nativas compartan un solo contrato en vez de inventar cada una el suyo.

**Alternativa descartada**: modelar esto como campos nuevos en `BlockListEntry` en vez de un modelo separado. Se descartó porque activar el bloqueo es una propiedad de la sesión de enfoque (`SoftFocusContext`), no de una entrada individual de la lista — las entradas de bloqueo ya se muestran todas juntas como recordatorio dentro de cualquier sesión de enfoque activa, sin importar qué la activó.

### 17. Calidad de screen time: tentaciones evitadas (tarea 5.9)

**Decisión**: `SerotoninSession` gana un contador `temptationsAvoided`, puntuado hasta 10 puntos en `calculateSerotoninScore` (se redujo el máximo de pilares de 60 a 50 para dejarle espacio real al puntaje, en vez de sumarlo por encima y que quede opacado cuando el usuario ya completa todos los pilares). Como `SerotoninSession` se guarda como JSON opaco (`sessionData: Json` en Prisma), no hizo falta migración.

El problema real de esta tarea es que la app no puede interceptar la apertura real de una app de terceros (no hay bloqueo a nivel de sistema operativo, fase 6/7). En vez de inventar un contador falso, se conecta a un evento real que ya existe gracias a la tarea 5.7: cuando `SoftFocusOverlay` muestra la pausa de fricción antes de salir del enfoque y el usuario elige "Volver al enfoque" en vez de completarla, eso es literalmente el momento en que estaba tentado a romper el bloqueo y no lo hizo — se cuenta como una tentación evitada real, no simulada. Se muestra como "N tentación(es) evitada(s) hoy" junto al puntaje en `SerotoninModePanel`.

**Límite conocido**: solo se cuenta la tentación de salir de un enfoque ya activo (pomodoro/manual/horario/ubicación). No cubre "el usuario nunca entró en modo enfoque pero igual evitó abrir una app de alta dopamina" — eso, otra vez, requeriría bloqueo real a nivel de sistema operativo.

### 18. Racha de pomodoros con tokens de gracia (tarea 5.10)

**Decisión**: la racha se recalcula siempre desde `PomodoroSession[]` (mismo principio que el score de hábitos: no se persiste un contador aparte que se pueda desincronizar). Un día cuenta como "completado" si tiene al menos una sesión con `!interrupted && endedAt` — la misma convención que ya usaba `lib/analytics/aggregate.ts` para el dashboard, reutilizada en vez de inventar una nueva definición de "pomodoro completado". El pool de gracia es fijo (2 días, `DEFAULT_GRACE_DAYS`) y se consume caminando hacia atrás desde hoy; un hueco se perdona solo si ya se encontró al menos un día completado en el camino (evita gastar gracia "puenteando" hacia una racha que nunca existió) y solo hasta la fecha del dato más antiguo conocido (evita gastar gracia infinitamente hacia atrás cuando simplemente no hay más historial).

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
