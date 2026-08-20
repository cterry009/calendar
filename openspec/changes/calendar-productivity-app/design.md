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

### 19. Selector de idioma ES/EN y alcance parcial de i18n (tarea 5.11)

**Decisión**: la tarea original solo pedía forzar un idioma único (español) y dejar el i18n completo para la fase 10. El usuario pidió explícitamente ampliar esto a un selector real ES/EN durante esta misma tarea. En vez de tratarlo como dos trabajos separados, se construyó un solo mecanismo — diccionarios por namespace + `LanguageContext` con `t()` — que sirve para ambos objetivos a la vez: hoy fuerza un idioma default consistente (español) y ya deja el selector funcionando, sin más migración cuando se retome la fase 10.

**Alcance decidido con el usuario** (pregunta directa, no asumido): traducir cada string de la app de una sola vez es un barrido mecánico enorme con alto riesgo de dejar mezclas a medio traducir — exactamente el bug que esta tarea busca eliminar. Se acordó ir por partes: núcleo primero (login/registro — el mix real que motivó la tarea —, `AppNav`, y el chrome propio del hub del calendario), el resto de paneles en iteraciones futuras. `t(key)` devuelve la propia key si no está traducida todavía, así que dejar coverage parcial no rompe nada ni se nota como texto vacío — simplemente ese string queda en español hasta que le llegue el turno.

**Alternativa descartada**: una librería de i18n completa (react-i18next, formatjs) para todo el barrido de una vez. Se descartó por ahora — el volumen real de strings y el riesgo de una migración a medias no justifican la dependencia nueva antes de saber cuánto del árbol de componentes se va a tocar; el `t()` casero cubre el caso de uso actual y es trivial de reemplazar después si hace falta pluralización o interpolación más compleja.

### 20. Tema claro con la misma paleta "Emerald Focus" (tarea 5.12, revisada)

**Decisión original (revertida por el usuario)**: se había decidido no construir tema claro y quedarse oscuro-únicamente, verificando que no hubiera ningún camino a medio construir hacia modo claro (`CalendarTheme` solo definía `dark`/`calm`, `CalendarProvider` siempre renderizaba `theme="dark"`, cero `prefers-color-scheme` en el repo). El usuario pidió explícitamente revertir esto: "configura bien la opcion de apareance y agrega el modo claro con la misma paleta de colores".

**Decisión final**: se agregó un tema `light` real, construido como la misma familia "Emerald Focus" invertida en luminosidad — no un volteo literal de los hex oscuros (eso da bajo contraste; texto `#4ee0a0` sobre blanco es casi ilegible), sino los mismos tonos verdes reprofundizados donde hace falta contraste real sobre blanco, igual que cualquier sistema de diseño con modo claro/oscuro. `paletteLight` en `packages/ui/src/tokens.ts` espeja campo por campo la estructura de `palette`; se registra en `tamagui.config.ts` dándole por fin un propósito real al tema `light` de fábrica de Tamagui que antes quedaba inerte (ver detalle técnico previo, ya resuelto).

La app ahora soporta cambio de tema en caliente: `CalendarProvider` recibe su prop `theme` de forma dinámica desde un nuevo `AppearanceProvider`/`useAppearance()` (persistido en localStorage, vive fuera de `CalendarProvider` en `main.tsx` ya que este último solo acepta un prop estático), con su toggle en el panel de Configuración (ver decisión 21).

**Bugs reales encontrados y corregidos al agregar el modo claro** (no cosméticos — sin esto, cambiar a claro dejaba cajas oscuras flotando sobre fondo blanco):
- `AppButton` (variantes `ghost`/`mood`) usaba overlays `rgba(255,255,255,...)` crudos, pensados para aclarar un fondo oscuro — invisibles/rotos sobre blanco. Se reemplazaron por tokens nuevos `overlaySubtle`/`overlayMedium`/`overlayStrong`, con los mismos valores exactos en oscuro (cero cambio visual ahí) y equivalentes oscurecedores en claro.
- `SerotoninModePanel` usaba `rgba(0,0,0,0.2)` para las filas de pilares/rituales — sobre blanco esto da un bloque gris plano, no un tinte sutil. Nuevo token `recessedFill`, con alpha mucho menor en claro para lograr el mismo efecto "hundido" sin verse como un bloque genérico.
- Siete formularios (`BlockListForm`, `FocusTriggerForm`, `BaselineAuditForm`, `PomodoroPage`, `MorningReview`, `EveningShutdown`) tenían `<select>`/`<textarea>` nativos con estilos inline oscuros hardcodeados — HTML nativo no puede leer tokens de Tamagui. Se unificaron detrás de un hook nuevo, `useNativeFieldStyle()`, que lee `palette`/`paletteLight` según el modo activo.
- `CalendarPage.tsx` (la página principal) envolvía todo en `<Theme name="dark">` hardcodeado — esto habría anulado silenciosamente el modo claro elegido por el usuario justo en la pantalla más importante de la app. Se eliminó ese wrapper (el `CalendarProvider` de la raíz ya provee el tema correcto).

**Dejado como está a propósito**: los scrims de pantalla completa (`SoftFocusOverlay`, `FrictionOverlay`, `OnboardingTutorial`) siguen oscuros sin importar el tema — es el mismo patrón que usan la mayoría de apps para modales/overlays dramáticos, no un bug.

### 21. Panel de Configuración consolidado (feedback post-5.11/5.12)

**Decisión**: el usuario marcó explícitamente que preferencias de app como el idioma (y, cuando exista, la apariencia) no deberían vivir como botones sueltos en la barra de navegación — deberían agruparse en una opción de "Configuración". Se agregó `settings` como un panel más del patrón deslizante de 5.1 (`SettingsPage.tsx`, registrado en `PanelHost.tsx`/`PanelContext.tsx` igual que Dashboard/Pomodoro/etc.), con secciones por preferencia (Idioma con el `LanguageToggle`; Apariencia con el `AppearanceToggle`, ver decisión 20). El botón `LanguageToggle` suelto que 5.11 había puesto directo en `AppNav.tsx` se sacó de ahí; `AppNav.tsx` ahora solo tiene un ícono de engranaje que abre el panel.

El toggle se había dejado también en `AuthLayout.tsx` (login/registro) razonando que antes de autenticarse no hay panel de Configuración al que ir. El usuario pidió explícitamente que no esté ahí ("la opcion de idiomas no deberia estar en el login") — se sacó por completo de `AuthLayout.tsx`. Login/registro ahora renderizan siempre en el idioma ya guardado (`es` por defecto si nunca se eligió nada) sin forma de cambiarlo antes de iniciar sesión; cambiar de idioma requiere estar autenticado y abrir Configuración. Preferencia del usuario sobre consistencia de superficie (todo lo de preferencias vive en un solo lugar) por encima de conveniencia pre-login.

**Rationale**: mismo principio que ya guía la IA de la app (decisión de agrupar `AppNav` por "por qué alguien abre la sección", no alfabético) — settings/cuenta es su propia categoría, ni "Planear" ni "Enfocarme" ni "Bienestar", así que amerita su propia entrada en vez de forzarla en un grupo existente o dejarla como botón huérfano.

### 22. Despejar la página principal del calendario (refinamiento de 5.1)

**Decisión**: el usuario marcó que la página principal (`CalendarPage.tsx`) había quedado saturada de información acumulada a lo largo de esta sesión (horarios, tareas completas, sugerencias, bienestar diario, todo incrustado debajo del calendario). Instrucción explícita: la página principal debe tener **solo** el calendario y el resumen semanal/mensual; el resto se reorganiza sin perder ninguna funcionalidad ni dato ("igual toda la información se debe guardar... es todo lo que estoy diciendo es visual").

Aclarado con el usuario (dos preguntas directas, ambas resueltas con la opción recomendada):
- **Tareas**: pasan de la tarjeta `TaskManager` completa (filtros por dificultad, "sin programar", tarjetas con 8 badges por tarea) a un `DayTasksSidebar` nuevo y deliberadamente minimalista en la barra lateral derecha — fila compacta (checkbox, título, cuenta de pomodoros, botón de iniciar pomodoro), filtrado a las tareas programadas para la fecha seleccionada en el calendario (hoy por defecto). La creación de tareas no cambia: sigue siendo "Q" / botón + Tarea / bloque de trabajo del día — este panel es solo para ver y actuar sobre lo que ya existe ese día, no para crear.
- **Horarios** (`ScheduleManager`): se queda en la misma barra lateral derecha, sin cambios internos — es la base que activa bloqueo/pomodoros, tiene sentido seguir viéndolo junto al calendario en vez de esconderlo en un panel aparte.

**Bienestar diario** (`SerotoninModePanel`) se movió a un panel propio (`WellnessPage.tsx`, panel id `wellness`), agregado al grupo **Planear** de `AppNav.tsx` (junto a Ritual diario/Dashboard/Sugerencias) — instrucción explícita del usuario ("junto con lo planear"), no una decisión de diseño propia. Mantiene toda su lógica intacta (pilares, rituales, pausa de respiración vía `FrictionOverlay`, check-in de ánimo).

**Sugerencias**: la tarjeta `SuggestionsPreview` (teaser con 3 sugerencias) se eliminó del código por completo, no solo de la página — quedó huérfana una vez sacada de `CalendarPage.tsx` (nada más la importaba) y el panel completo de Sugerencias ya es accesible desde `AppNav`, así que mantenerla habría sido código muerto duplicando una función que ya existe en otro lado.

### 23. Backend de sonido ambiental Spotify — diseño (tarea 5.14, no implementada)

**Estado**: solo diseño. Ningún archivo de este apartado existe todavía en `server/src` — se especifica ahora para poder implementarlo directo sin rediscutir la forma, tal como ya se hizo con `hardMode` (decisión 14) y `FocusTrigger` (decisión 16) antes de construirlos.

**Modelo de datos** — nuevo `SpotifyIntegration` (no reutiliza `Device.refreshToken`, que es el refresh token propio de la app, no de un tercero):

```prisma
model SpotifyIntegration {
  id                String   @id @default(cuid())
  userId            String   @unique
  spotifyUserId     String
  accessTokenEnc    String   // cifrado en reposo, no en texto plano
  refreshTokenEnc   String   // cifrado en reposo, no en texto plano
  accessTokenExpiresAt DateTime
  scope             String
  connectedAt       DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("spotify_integrations")
}
```

`accessTokenEnc`/`refreshTokenEnc` van cifrados con AES-256-GCM usando una clave de servidor (`SPOTIFY_TOKEN_ENCRYPTION_KEY`, variable de entorno nueva, nunca en el repo) — a diferencia de los JWT propios de la app (revocables centralmente y de vida corta), un refresh token de Spotify es una credencial de terceros de vida larga; si la base de datos se filtra, un token en texto plano da acceso indefinido a la cuenta de Spotify del usuario.

**Flujo OAuth (Authorization Code + PKCE, mediado por servidor — no el mismo patrón que Google/Apple)**: Google/Apple en `oauth.service.ts` reciben un `id_token` ya emitido por un SDK cliente y solo lo verifican; Spotify no tiene ese modo simplificado para Web Playback, así que el servidor debe ejecutar el intercambio completo:

1. `GET /spotify/authorize` — el servidor genera `code_verifier`/`code_challenge` y un `state`, guarda `state → code_verifier` en Redis (ya disponible, decisión 1.4) con TTL corto (5 min), y devuelve la URL de autorización de Spotify (`scope` mínimo: `streaming user-read-email user-read-private`).
2. `GET /spotify/callback?code&state` — recupera el `code_verifier` de Redis por `state`, intercambia `code` por `access_token`/`refresh_token` en el endpoint de token de Spotify, cifra y guarda en `SpotifyIntegration` (upsert por `userId`), redirige de vuelta a la app.
3. `GET /spotify/status` — `{ connected: boolean, spotifyUserId? }`, nunca expone tokens.
4. `POST /spotify/disconnect` — borra la fila; no revoca el token en Spotify (Spotify no ofrece endpoint de revocación pública), documentar esa limitación igual que la de Premium (decisión 11).
5. `GET /spotify/access-token` — devuelve un `access_token` vigente y de vida corta (refresca automáticamente contra Spotify si venció, usando `refreshTokenEnc`) para que el Web Playback SDK lo use directo en el navegador. El `refresh_token` nunca sale del servidor.

**Módulo**: `server/src/spotify/` (`spotify.module.ts`, `spotify.controller.ts`, `spotify.service.ts`, `dto/spotify-callback.dto.ts`), mismo patrón de carpeta que `auth/`.

**Playlists curadas**: lista estática server-side (`spotify.constants.ts`, sin llamada a la API de Spotify) de URIs de playlists públicas categorizadas (deep-focus, lofi, ruido de lluvia) — evita depender de una búsqueda dinámica que podría devolver contenido no apto.

**Fallback sin cuenta**: los 3-4 loops ambientales propios (lluvia, ruido blanco, lofi) son archivos estáticos servidos desde `apps/web/public/audio/` — no requieren backend en absoluto, ya que no hay estado de usuario que persistir para ellos.

**Fuera de este diseño (frontend, tarea 5.14 completa)**: el widget de reproducción embebido en el panel de Pomodoro y `SoftFocusOverlay.tsx`, y el enganche a `isPomodoroBlocking`/`manualSoftFocus.active`/`isWorkHoursActive` para auto-play/pausa — ya descritos en la decisión 11, sin cambios.

### 24. Fricción de ejercicio verificada por cámara — diseño (tarea 5.15, no implementada)

**Estado**: solo diseño, nada implementado todavía.

**Punto clave**: esta tarea es casi enteramente frontend. La verificación de repeticiones/tiempo de plancha vía pose estimation corre 100% on-device (MediaPipe Pose Landmarker o ML Kit, ambos con runtime WASM/nativo en el cliente) precisamente para cumplir "ningún frame ni video sale del dispositivo" — el backend nunca recibe imágenes, video, ni landmarks de pose. Lo único que le corresponde al backend es el modelado de datos de configuración, siguiendo el mismo patrón ya usado para `hardMode` (decisión 14) y `FocusTrigger` (decisión 16): especificar el contrato ahora para que Android/Windows (fase 6/7) lo compartan en vez de inventar cada uno el suyo.

**Modelo de datos** — extiende `BlockListEntry` en vez de crear una tabla nueva, porque la fricción es una propiedad de cómo se desbloquea *esa* entrada, igual que `hardMode` ya lo es:

```prisma
enum BlockFrictionType {
  NONE       // comportamiento actual: enabled/hardMode deciden si se puede apagar, sin paso extra al abrir
  BREATHING  // reusa el FrictionOverlay de respiración 4-7-8 ya construido (decisión 15)
  EXERCISE   // nuevo: sentadillas / plancha / flexiones
}

enum ExerciseKind {
  SQUATS
  PLANK
  PUSHUPS
}

model BlockListEntry {
  // ...campos existentes sin cambios...
  frictionType   BlockFrictionType @default(NONE)
  exerciseKind   ExerciseKind?     // solo cuando frictionType = EXERCISE
  exerciseTarget Int?              // repeticiones (sentadillas/flexiones) o segundos sostenidos (plancha)
}
```

Migración: `ALTER TABLE block_list_entries ADD COLUMN "frictionType" ... DEFAULT 'NONE'`, `ADD COLUMN "exerciseKind"`, `ADD COLUMN "exerciseTarget"` — no rompe filas existentes (default `NONE` preserva el comportamiento actual exacto).

**DTO/sync**: `BlockListEntry` ya viaja por el pipeline unificado de `server/src/sync` (batch/pull) igual que `hardMode` — los tres campos nuevos se agregan al DTO existente y al schema Zod compartido (`packages/shared`), sin endpoint nuevo. Validación server-side: `exerciseKind`/`exerciseTarget` obligatorios y coherentes solo cuando `frictionType = 'EXERCISE'` (igual patrón que la validación cruzada ya usada para los campos condicionales de `FocusTrigger` por `kind`).

**Fuera de este diseño (frontend, cuando se implemente completo)**:
- Vista de cámara a pantalla completa lanzada al abrir una entrada bloqueada con `frictionType = EXERCISE`, reutilizando el layout de `FrictionOverlay` (acción principal deshabilitada hasta cumplir el objetivo) en vez de un componente nuevo desde cero.
- Máquina de estados por ángulo de articulación (abajo→arriba = 1 repetición en sentadillas/flexiones; ángulo sostenido = tiempo válido en plancha).
- Permiso de cámara solicitado solo la primera vez que se usa este tipo de fricción, y solo en primer plano (nunca en segundo plano).
- Extensión de `BlockListForm`/`BlockListItem` para configurar `frictionType`/`exerciseKind`/`exerciseTarget` por entrada, mismo patrón de UI que ya existe para `hardMode`.

**Alternativas descartadas** (ya reflejadas en la descripción de la tarea, confirmadas aquí como parte del diseño): SDKs de reconocimiento de ejercicio de terceros (rompen el principio "sin dependencia de nube / sin telemetría" ya implícito en el diseño local-first de esta app — ver decisión 13); checkbox manual "hice ejercicio" (trivial de hacer trampa, anula el propósito de un mecanismo de fricción).

**Nota de alcance para el tutorial (5.16)**: cuando 5.14 y 5.15 se implementen, su tour por-feature debe agregarse al catálogo de 5.16 (sonido ambiental dentro del tour de Pomodoro/foco; fricción por ejercicio dentro del tour de lista de bloqueo) — ver nota agregada en la tarea 5.16 de `tasks.md`.

### 25. Tutorial spotlight por-feature (tarea 5.16)

**Decisión**: el tutorial pasa de una sola lista de texto con scroll a un motor de "tours" data-driven (`apps/web/src/lib/onboarding/tours.ts`) que resalta el elemento real de la pantalla del que está hablando, en vez de flotar una tarjeta sin ninguna conexión visual con lo que describe.

**Por qué un registro de datos y no un componente por tour**: cada tour es solo una lista de `{ target, title, description }` más el panel (si alguno) que debe estar abierto para que esos targets existan en el DOM. Esto evita construir 8 componentes de tour casi identicos -- el motor (`OnboardingTutorial.tsx`) es uno solo, genérico, que no sabe nada de paneles ni de contenido; solo sabe leer `data-tutorial="X"` del DOM.

**Por qué el motor no abre paneles el mismo**: `OnboardingProvider` es ancestro de `PanelProvider` en `ProtectedAppLayout.tsx` (no al revés), asi que `OnboardingContext` no tiene acceso a `usePanel()`. En vez de reestructurar el arbol de providers, la responsabilidad de abrir/cerrar el panel correcto antes de arrancar un tour vive en quien SI tiene ambos contextos: el menu "?" en `AppNav.tsx` (`handleSelectTour`), que llama `openPanel()`/`closePanel()` y recien despues `startTour()`, con un pequeño delay (380ms) para que el panel termine de animar antes de que el spotlight mida su posicion.

**Bug real encontrado durante la verificacion (no cosmetico)**: los targets del panel lateral derecho (`schedule-header`, `tasks-header`) quedan fuera del viewport en anchos moderados -- el `XStack` de `CalendarPage.tsx` tiene `flexWrap="wrap"` y a 1440px la columna lateral cae a una fila nueva, mucho mas abajo de la pantalla inicial. El primer intento del motor solo hacia `getBoundingClientRect()` sin scrollear, dejando el tooltip clampeado fuera de vista (boton "Cerrar" inalcanzable, confirmado con Playwright). Se corrigio agregando `element.scrollIntoView({ block: 'center' })` antes de medir cada target -- el mismo problema aplicaria a cualquier usuario con una ventana angosta, no solo a la prueba automatizada.

**Manejo de targets que no existen en la vista actual**: un paso cuyo target nunca aparece (ej. `day-work-block`, que solo existe en la vista Dia del calendario, no en Semana/Mes) hace polling cada 60ms hasta 700ms y despues avanza solo al siguiente paso en vez de dejar el tour trabado en un paso invisible.

**Colores del spotlight, no del scrim**: el fondo oscuro de pantalla completa sigue el mismo patron ya establecido para `SoftFocusOverlay`/`FrictionOverlay` (decision 20: "Dejado como esta a proposito... siguen oscuros sin importar el tema") -- no cambia con el tema. El borde verde que resalta el elemento SI lee `palette`/`paletteLight` segun `useAppearance().mode` (igual que `useNativeFieldStyle()`), porque ese elemento vive dentro de la tarjeta de contenido, que si se ve en ambos temas -- verificado con captura en modo claro, sin el bug de "caja oscura sobre fondo blanco" que motivo gran parte de la decision 20.

**Alcance de idioma**: el contenido de los tours (titulos, descripciones) queda en español hardcodeado, igual que estaba antes de esta tarea -- no se paso por el sistema `t()` de la decision 19. Es la misma frontera de alcance que ya tienen el resto de paneles no traducidos todavia; ampliar el tutorial mismo ya era suficiente superficie para esta tarea sin sumarle tambien su traduccion.

### 26. Scaffold de Android con Expo Router (tarea 6.1)

**Decisión**: `apps/mobile` real (Expo Router, managed workflow, SDK 57) reemplaza el stub `@calendar/mobile` ("scaffold pending"). Se confirmó con el usuario antes de arrancar: managed workflow + Expo Router (no bare) y priorizar el scaffold básico antes de diseñar el bloqueo real por Accessibility Service (tarea 6.6) — ese mecanismo se investiga cuando toque esa tarea, no ahora.

**Resolución de monorepo sin npm workspaces**: igual que `apps/web` (que alía `@calendar/shared`/`@calendar/ui` a los archivos fuente vía `resolve.alias` de Vite, sin instalarlos como paquetes npm), `apps/mobile/metro.config.js` hace lo mismo para Metro:
- `watchFolders` apunta a las raíces de `packages/shared` y `packages/ui` (no solo a su `src/`) — Metro solo resuelve `node_modules` dentro de sus carpetas vigiladas, así que vigilar solo `src/` le impedía encontrar los propios `node_modules` de `packages/ui` (`tamagui`, `@tamagui/animations-react-native`, etc.) al resolver imports *desde* esos archivos fuente.
- `extraNodeModules` es un `Proxy`: los alias `@calendar/shared`/`@calendar/ui` se resuelven a sus carpetas `src/`; cualquier otro import que Metro no logre resolver localmente cae a `apps/mobile/node_modules/<paquete>` — necesario porque `packages/ui/src` importa `react`/`react/jsx-runtime` como *peer dependency* (nunca instalados ahí a propósito, igual que en web) y Metro, a diferencia de Vite, no resuelve automáticamente esos imports contra el `node_modules` de la app consumidora.

**Bug real encontrado #1 — dos instancias de Tamagui**: `packages/ui` y `apps/mobile` instalan `tamagui`/`@tamagui/*` cada uno por su lado (necesario para que `packages/ui` tenga sus propios `typecheck`/`lint` standalone). Sin corrección, Metro resolvía esos imports contra la copia más cercana al archivo que los pedía — dos registros de módulo de Tamagui separados y sin contexto compartido, así que el `TamaguiProvider` de la app (construido con su propia instancia) no reconocía un `AppButton` styled con la instancia de `packages/ui`. Síntoma real: `Cannot read properties of null (reading 'map')` al renderizar cualquier `<Button>`. Corregido forzando, en `resolveRequest`, que cualquier import *bare* (no relativo, no `@calendar/*`) que se origine físicamente dentro de `packages/ui/src` o `packages/shared/src` se resuelva como si viniera de la raíz de esta app (`originModulePath` falsificado apuntando a `apps/mobile/package.json`) — una sola instancia real de todo, como si estuviera hoisteado.

**Bug real encontrado #2 — animaciones RN rotas bajo react-native-web específicamente**: incluso con una sola instancia de Tamagui, cualquier `<Button animation="...">` (cualquier nombre, no solo uno custom) seguía crasheando con el mismo error, esta vez rastreado hasta `RN Animated.Value.interpolate()` (`createInterpolationFromStringOutputRange`) llamado desde el hook `useAnimations` de `@tamagui/animations-react-native`. Sin ese prop, o con `expo start --web` apuntando al config `tamagui.config.ts` (driver CSS, el mismo que ya usa `apps/web`) en vez de `tamagui.config.native.ts` (driver `Animated` de RN), todo funciona. Conclusión: el driver de animaciones basado en `Animated` de RN no es compatible con react-native-web en esta combinación de versiones (Expo 57 / RN 0.86 / `@tamagui/animations-react-native` 1.144.4) — no necesariamente un problema en Android/iOS reales, que usan la implementación nativa completa de `Animated`, no el shim de react-native-web.

**Decisión de diseño resultante**: `packages/ui` ahora expone `createTamaguiConfig.ts` (fábrica compartida, todo excepto el driver de animaciones) más dos configs concretos — `tamagui.config.ts` (CSS, ya existía, sin cambios de comportamiento) y `tamagui.config.native.ts` (nuevo, driver `Animated` de RN). `apps/mobile/src/app/_layout.tsx` elige entre ambos con `Platform.OS === 'web' ? webConfig : nativeConfig` **en tiempo de ejecución**, no vía la convención de extensión `.native.ts`/`.web.ts` de Metro — se probó esa vía primero (más idiomática) pero, a través del `Proxy` de `extraNodeModules` que este monorepo necesita para llegar a `packages/ui/src`, Metro seguía prefiriendo `.native.ts` incluso compilando para `web`; el chequeo explícito por `Platform.OS` es menos elegante pero deja de depender de un comportamiento de Metro que no se pudo confirmar como confiable en este setup. Costo aceptado: ambos drivers de animación (`@tamagui/animations-css` y `@tamagui/animations-react-native`) quedan empaquetados en cada build (web y nativo) aunque solo se use uno — no vale la pena perseguir el bundle-splitting perfecto todavía.

**Verificado, no verificado**: `expo start --web` + Playwright confirma que el diseño compartido (tokens, tipografía, layout, tema oscuro "Emerald Focus") y `@calendar/shared` (lógica pura) funcionan sin cambios en este runtime, y que `AppButton` con su animación real (`animation: 'magnetic'`) ya no crashea. Lo que sigue sin verificar en este entorno (sin SDK/emulador de Android instalado en esta máquina Windows) es el comportamiento en Android real — la próxima vez que se retome trabajo nativo (inicio de la tarea 6.2), confirmar en un emulador o dispositivo real antes de asumir que el driver `Animated` nativo funciona igual de bien que su versión web.

### 27. Auth nativo — primera porción de la tarea 6.2

**Decisión**: portar la tarea 6.2 de forma incremental, empezando por auth (login/registro/logout) en vez de intentar las seis áreas del checklist (auth, calendario, tareas, pomodoro, fitness, analítica) de una sola vez -- nada más funciona sin sesión, así que es el corte vertical más chico que igual entrega algo end-to-end verificable contra el servidor real.

**Qué se portó tal cual, qué cambió**: el contrato HTTP (`/auth/register|login|refresh|logout|me`), la forma de `AuthSession`/`AuthUser`/`LoginInput`/`RegisterInput`, y la lógica de `apiFetch` (reintento automático en 401 vía `/auth/refresh`) se portaron sin cambios de comportamiento desde `apps/web/src/lib/api.ts`. Lo único que cambia por plataforma:
- **Storage**: `apps/web`'s `auth-storage.ts` usa `localStorage` (síncrono); `apps/mobile` necesita async storage. En vez de usar `@react-native-async-storage/async-storage` en todos lados, se creó `platformStorage.native.ts`/`platformStorage.web.ts` (resueltos por la convención de extensión de plataforma de Metro, no por el `Proxy` de `extraNodeModules` de packages/ui -- ver bug abajo) porque el shim web de AsyncStorage **crashea al importarlo** en este setup (`Cannot read properties of undefined (reading 'bind')`, rastreado hasta `mergeOptions.bind(...)` en su dependencia `merge-options`, que resuelve a `undefined` bajo el bundling web de Metro). Como el target web de este proyecto es un navegador real, `platformStorage.web.ts` simplemente usa `window.localStorage` directo, sin pasar por el shim roto.
- **Base URL**: `EXPO_PUBLIC_API_URL` (equivalente a `VITE_API_URL` de la web), con `10.0.2.2:3000` como default en Android (el emulador no puede alcanzar `localhost` del host) y `localhost:3000` en el resto.
- **Device label/platform**: `DEVICE_PLATFORM` se calcula por `Platform.OS` (`ANDROID`/`IOS`/`WEB`) en vez del `'WEB'` fijo de la web.
- **OAuth**: no portado. `apps/web`'s `OAuthButtons.tsx` carga SDKs de JS de Google/Apple en el navegador -- no existe equivalente directo en RN, requiere `expo-auth-session`/`@react-native-google-signin` y `expo-apple-authentication`, tratado como tarea aparte.

**Guard de rutas**: `Stack.Protected` de expo-router (`guard={isAuthenticated}` / `guard={!isAuthenticated}` en `_layout.tsx`) en vez de una redirección manual -- es el mecanismo soportado oficialmente por expo-router para este patrón exacto (grupos de pantallas condicionados a un estado), evita reinventar la lógica de redirect-on-mount que ya se resolvió una vez en `apps/web`'s `AuthContext`.

**Bug real encontrado al verificar con Playwright**: el `Input` de Tamagui en react-native-web renderiza un segundo nodo invisible con `aria-labelledby` junto al input real (aparentemente para accesibilidad) -- los selectores de Playwright basados en placeholder/label sin filtrar por visibilidad matcheaban el nodo equivocado (`strict mode violation`, y despues `element is not visible` al intentar rellenar el oculto). No es un bug de la app -- se corrigió en el script de verificación con selectores CSS `:visible`, documentado por si vuelve a aparecer en pantallas futuras.

### 28. Calendario/tareas "de hoy" — segunda porción de la tarea 6.2

**Decisión**: seguir el mismo enfoque incremental que auth -- en vez de portar la grilla completa de calendario (día/semana/mes con drag-and-drop, mucho trabajo de UI específico de web difícil de trasladar 1:1 a nativo), la segunda porción es una vista "de hoy": las tareas programadas para hoy y el horario de trabajo/descanso de hoy, en formato lista compacta.

**Sin cache offline todavía, a propósito**: `useCalendarData` llama `/sync/pull` directo cada vez (sin IndexedDB, sin WebSocket) -- exactamente lo que la tarea 6.3 ("Implement expo-sqlite offline storage and sync queue") va a agregar. Portar esa capa ahora hubiera mezclado dos tareas del roadmap en una.

**Filtro "de hoy" client-side, igual que la web**: no existe un parámetro de fecha en `/sync/pull` (se confirmó revisando `server/src/sync/sync.controller.ts` -- devuelve el snapshot completo siempre); `apps/web` tampoco lo usa, filtra en cliente. Se replicó la misma regla exacta: tareas por `scheduledAt` mismo día (`isSameDay`), horarios por `daysOfWeek.includes(today.getDay())` -- mismas funciones, mismo criterio que `DayTasksSidebar`/`findActiveWorkSchedule` en la web, no una regla nueva inventada para nativo.

**Reutilización real de la porción de auth**: `useCalendarData` y `lib/calendar/api.ts` llaman al mismo `apiFetch` de `lib/auth/api.ts` -- el reintento automático en 401 vía refresh token que ya se construyó para auth funciona acá sin ningún cambio adicional.

**Verificado contra el servidor real**: se creó una tarea y un horario vía una llamada directa a `/sync/batch` (mismo access token que guarda `AuthContext`), se recargó la app y se confirmó que ambos aparecen correctamente, y que tocar la tarea la completa (checkmark + tachado) -- sin errores de consola.

### 29. Pomodoro nativo — tercera porción de la tarea 6.2

**Decisión**: portar el temporizador pomodoro casi línea por línea desde `apps/web/src/context/PomodoroContext.tsx`, ya que su mecanismo central (diffing de reloj de pared, no un countdown acumulado) ya es exactamente el patrón correcto y seguro para nativo -- no había nada que rediseñar, solo adaptar las dos piezas que sí son específicas de plataforma.

**Por qué el timer no necesita cambios**: `remainingSeconds` se calcula siempre como `duracionDeFase - (ahora - session.startedAt)`. El `setInterval` de 1 segundo solo fuerza un re-render; nunca es la fuente de verdad. Esto importa más en nativo que en web -- RN puede pausar/acelerar timers en segundo plano de forma menos predecible que un tab de navegador -- pero como el valor mostrado siempre se deriva del diff contra `startedAt`, un tick perdido o atrasado nunca desincroniza el conteo, solo hace que la UI tarde un instante en "ponerse al día" la próxima vez que corre. Se agregó un listener de `AppState` que fuerza esa actualización inmediatamente al volver del segundo plano, en vez de esperar hasta 1 segundo al próximo tick -- una mejora de UX, no una corrección de bug.

**Máquina de estados 100% reutilizada sin cambios**: `packages/shared/src/pomodoro/state-machine.ts` (`transitionPomodoro`, `createPomodoroSession`, `getPhaseDurationMinutes`, `isBlockingPhase`) es lógica pura sin dependencias de DOM -- se importa tal cual, cero adaptación, la misma prueba de "de verdad es codigo compartido" que ya se hizo con `computePomodoroStreak` en el scaffold inicial (decisión 26).

**Capa de sync consolidada**: con tareas, horarios y ahora pomodoro compartiendo el mismo endpoint `/sync/pull` + `/sync/batch`, se extrajo `apps/mobile/src/lib/sync/api.ts` como la única capa HTTP compartida (antes `lib/calendar/api.ts` tenía su propia copia de `pullSnapshot`) -- evita que cada dominio nuevo (fitness, analítica, más adelante) reinvente la misma llamada.

**Dos recortes deliberados, mismo patrón que OAuth (decisión 27)**: no se portó el override de configuración por sesión (`start(taskId, overrideConfig)` en la web) ni las notificaciones basadas en `window.Notification` del navegador -- el equivalente nativo real es `expo-notifications` con su propio flujo de permisos, una tarea aparte, no algo para simular a medias acá. `crypto.randomUUID()` (usado por la web para generar IDs de sesión) se reemplazó por `expo-crypto`'s `Crypto.randomUUID()`, ya que Hermes no garantiza `crypto.randomUUID` global en este setup.

**Verificado end-to-end** vía `expo start --web` + Playwright: temporizador inactivo muestra 25:00 -> iniciar muestra "Enfoque" y cuenta regresiva real (confirmado que el número baja en una espera de ~3s, no solo un render estático) -> cancelar vuelve a inactivo -> navegación de vuelta a inicio funciona. Cero errores de consola.

### 30. Fitness nativo — cuarta porción de la tarea 6.2

**Decisión**: mismo patrón incremental que auth/calendario/pomodoro. `apps/web`'s `lib/fitness/summary.ts` (agregación diaria/semanal de minutos) es TypeScript puro sin ninguna dependencia de DOM -- se portó literalmente sin cambios, la misma prueba de "esto sí es código realmente compartible" que ya dio la máquina de estados de pomodoro (decisión 29). El panel de correlación fitness-productividad (`FitnessCorrelationPanel`) vive en el dashboard en la web, no en `FitnessPage.tsx` -- quedó fuera de esta porción sin necesidad de decidir nada, simplemente no es parte de lo que se está portando (la pantalla de fitness en sí).

**Recortes deliberados, mismo patrón que OAuth/notificaciones (decisiones 27/29)**: sin selector de fecha/hora (cada registro queda como "ahora mismo" -- un selector nativo real es `@react-native-community/datetimepicker`, un módulo nativo nuevo que no se sumó en esta pasada) y sin edición de registros existentes (solo crear y borrar, mismo alcance que ya tiene la pantalla de tareas).

**Bug real encontrado y corregido**: `Alert.alert()` de react-native-web es un no-op completo -- literalmente `static alert() {}` en su código fuente, ni siquiera invoca los `onPress` de los botones que se le pasan. El flujo de "confirmar antes de borrar" (igual al `window.confirm()` que ya usa `FitnessItem.tsx` en la web) no hacía nada en el target de verificación web: se tocaba "Eliminar" y no pasaba nada, sin error visible tampoco. Se corrigió con un helper chico, `confirmDestructiveAction()` (`apps/mobile/src/lib/confirmAction.ts`), que usa `window.confirm()` real en web y `Alert.alert()` en nativo -- el mismo patrón de bifurcación por `Platform.OS` que ya se usa para `platformStorage.{web,native}.ts` (decisión 27). Vale la pena tenerlo presente para cualquier futura pantalla que necesite confirmaciones destructivas (por ejemplo, borrar una tarea o un hábito).

**Verificado end-to-end** vía `expo start --web` + Playwright: crear un registro -> aparece en la lista con la intensidad/duración correctas, el resumen de hoy se actualiza (30 min, 1 sesión) -> borrar (el diálogo de confirmación aparece y se acepta) -> vuelve al estado vacío. Cero errores de consola.

### 31. Dashboard nativo — quinta y última porción de la tarea 6.2

**Decisión**: mismo patrón que las cuatro porciones anteriores. `buildDashboardMetrics()` (`apps/web/src/lib/analytics/aggregate.ts`) es el único orquestador del que depende toda la pantalla de dashboard en la web -- se confirmó que es TypeScript puro (solo usa `Date`/`toLocaleDateString`, cero DOM) y se portó literal. Se descartó el campo `suggestions` del tipo portado: el propio `DashboardPage.tsx` de la web nunca lo renderiza (vive en un panel de sugerencias aparte), así que portar `generateSuggestions()`/`buildSuggestionInput()` acá hubiera sido peso muerto sin ningún beneficio real.

**Sin librería de gráficos, en ningún lado**: se confirmó revisando `package.json` que la web no tiene ninguna dependencia de charting (nada de recharts/victory/d3/etc) -- todos los "gráficos" del dashboard son `YStack` de Tamagui con `height`/`width` calculados como porcentaje. Esto significa que el gráfico de barras de 14 días de enfoque se portó con la misma técnica exacta, no una simplificación forzada por no tener la librería equivalente en nativo -- ya era simple desde el origen.

**Cierre explícito de la tarea 6.2**: con esta quinta porción, 6.2 se marca completa en el alcance que efectivamente se construyó a lo largo de las cinco porciones (auth, calendario "de hoy", pomodoro, fitness, dashboard). Lo que se dejó fuera a propósito, documentado como trabajo de seguimiento y no como omisión silenciosa: la grilla completa de calendario día/semana/mes con drag-and-drop; OAuth nativo; notificaciones push/locales; un selector de fecha/hora nativo; y edición de tareas/registros de fitness existentes (en toda la tarea 6.2 solo se portó crear + completar/borrar). El storage offline (equivalente a IndexedDB + cola de sync) es la tarea 6.3, deliberadamente mantenida aparte en las cinco porciones para que cada una fuera un corte vertical real y verificado contra el servidor, en vez de una abstracción a medio construir.

**Verificado end-to-end** vía `expo start --web` + Playwright contra el servidor real: cuenta nueva muestra el estado vacío correcto ("no hay suficientes datos") -> se sembró una tarea completada (30 min estimados / 45 reales) + un pomodoro completado + un registro de fitness vía llamada directa a la API -> tras recargar, todas las tarjetas muestran los números correctos (1 tarea, 1 pomodoro, 0.4 horas de enfoque, +15 min de variación en color de alerta). Cero errores de consola.

### 32. Storage offline y cola de sync — tarea 6.3

**Decisión**: mismo alcance que la web -- un blob JSON del snapshot completo cacheado + una tabla de cola append-only, no tablas relacionales por entidad. Se consideró normalizar en tablas reales (`tasks`, `schedules`, etc., con índices por `id`/`updatedAt`), lo que habilitaría un merge optimista real (mostrar una tarea creada offline inmediatamente, no solo tras el flush) -- pero eso es estrictamente más trabajo y la web tampoco lo tiene (documentado explícitamente en la investigación previa como una limitación real: escribir offline en la web "funciona" pero no se refleja en la UI hasta el siguiente flush + pull). Igualar el comportamiento de la web primero, y dejar la normalización como mejora de UX a futuro, es la decisión correcta para un v1 -- no una limitación técnica de SQLite.

**Por qué `pullSnapshot()`/`syncBatch()` no cambiaron de firma**: viven en `lib/sync/api.ts`, ya el único punto de acceso HTTP que usan los cuatro hooks existentes (`useCalendarData`, `useFitness`, `useDashboard`, `PomodoroContext`). Actualizarlas *en el lugar* para que sean conscientes de offline, sin tocar su firma pública (`Promise<SyncSnapshot>` / `Promise<SyncBatchResponse>`, igual que antes), significa que ninguno de esos cuatro hooks necesitó cambios en su lógica de lectura/escritura -- ganan cache y cola gratis. La única integración nueva que sí tocó los cuatro archivos fue `registerRefetch()`, para que la pantalla vigente se actualice sola cuando la cola se vacía.

**Bug real encontrado durante la verificación**: `@react-native-community/netinfo` en web prefiere la Network Information API del navegador cuando existe, que refleja el tipo de interfaz a nivel de SO -- y **no se actualiza confiablemente ante cualquier cambio de conectividad dado** (confirmado: bajo la emulación de `context.setOffline()` de Playwright, `navigator.onLine` sí cambia correctamente pero la Network Information API no, y el código de netinfo prioriza esta última cuando está presente). Esto significa que el pre-chequeo `NetInfo.fetch()` puede reportar "en línea" de forma incorrecta. La solución no fue parchear netinfo, sino dejar de confiar en el pre-chequeo como fuente de verdad: `isOnline` ahora se deriva del resultado real de cada request (éxito/fracaso dentro de `pullSnapshot`/`syncBatch`/`flushSyncQueue`), y NetInfo/AppState/un poll cada 5s cuando hay cola pendiente quedan como *disparadores* de reintento, no como fuente del estado mostrado. Este patrón -- "confiar en el resultado real de la operación, no en un pre-chequeo de una API de plataforma" -- es más robusto en general, no solo un parche para el entorno de pruebas.

**Verificado end-to-end** vía `expo start --web` + Playwright con `context.setOffline()`: lectura online cachea el snapshot -> navegación offline (client-side, sin reload completo -- una app instalada real ya tiene su bundle JS, solo las llamadas a la API van por red) sigue mostrando los últimos datos conocidos con el banner "Sin conexión" correcto -> crear un registro de fitness offline lo encola en silencio (sin error visible, igual que la web) con el banner de cambios pendientes -> reconectar dispara el flush automáticamente (sin recargar) y el registro aparece en la misma pantalla -> un reload posterior confirma que realmente llegó al servidor.

### 33. Notificaciones locales para pomodoro y sugerencias — tarea 6.4

**Decisión**: "push notifications" en el nombre de la tarea se interpretó como notificaciones **locales**, no push remoto real. Los dos disparadores que pide la tarea -- una fase de pomodoro que termina, una sugerencia nueva -- son eventos que el propio dispositivo ya conoce sin necesidad de un servidor: el temporizador corre en el cliente (decisión 29), y las sugerencias se calculan de los mismos datos que ya trae el dashboard. Construir push remoto real (tokens push de Expo, envío desde el servidor, confiabilidad de entrega en segundo plano) sería una tarea genuinamente aparte, no una simplificación de ésta -- ninguno de los dos casos de uso listados en la tarea original lo necesita.

**Sugerencias sin infraestructura de tareas en segundo plano**: en vez de `expo-background-fetch`/`expo-task-manager` (complejidad real: permisos de SO, límites de frecuencia de iOS/Android, imposible de verificar en este entorno de todos modos), el chequeo de sugerencias corre cada vez que se abre el dashboard -- mismo dato que ya calcula `useDashboard`, sin fetch aparte. Deduplicado a lo sumo una notificación por día (por tipo de sugerencia, así que si la sugerencia principal cambia el mismo día igual notifica una vez) vía la misma abstracción `platformStorage` ya usada para tokens de auth.

**Bug/limitación real encontrada al verificar**: `expo-notifications` en web tiene permisos reales (usa la API `Notification` del navegador de verdad, confirmado leyendo su código fuente) pero su programador de notificaciones (`NotificationScheduler`) es un stub sin ningún método -- `scheduleNotificationAsync()` en web siempre lanza `UnavailabilityError`. A diferencia del `Alert.alert()` no-op de react-native-web (decisión 30, que fallaba en silencio), acá el error SÍ se lanza, así que `sendLocalNotification()` lo atrapa explícitamente y lo descarta solo en `Platform.OS === 'web'` -- en nativo el error se propaga de verdad, ya que ahí `scheduleNotificationAsync` sí debería funcionar.

**Límite de verificación, dicho con honestidad**: una notificación real (el popup del navegador o del sistema operativo) no es algo que Playwright pueda observar en una captura de pantalla -- vive fuera del DOM de la página. Lo que sí se verificó de punta a punta: el flujo de permisos (con `context.grantPermissions(['notifications'])`, el toggle refleja un permiso de navegador real y concedido), y que el código que dispara la notificación se ejecuta sin errores exactamente en el momento en que una fase de pomodoro termina (se forzó vía un patch directo a la API cambiando `startedAt` a "hace 24m59s", en vez de esperar 25 minutos reales). La entrega real en un dispositivo nativo queda como lo único no verificable en este entorno, igual que el resto de la sesión.

### 34. Picker de apps instaladas en Android — tarea 6.5, y la decisión de escribir código nativo sin poder probarlo

**Contexto**: a diferencia de 6.1-6.4 (todas construibles y verificables enteramente contra `expo start --web`), 6.5 requiere leer la lista real de apps instaladas del sistema operativo -- algo que ningún navegador expone. Este entorno Windows no tiene SDK de Android, JDK ni `adb` instalados (confirmado: `java` no encontrado, sin `ANDROID_HOME`, sin carpeta de SDK en ninguna ruta esperada), así que compilar o correr un dev client de Android está fuera de alcance acá.

**Decisión, con el usuario explícitamente consultado**: ante tres opciones (escribir el código nativo real sin poder probarlo; construir solo la UI/integración con datos vacíos dejando la enumeración como TODO; pausar la fase 6 hasta tener el entorno) el usuario eligió la primera -- escribir la implementación real, dejarla lista para compilar y probar cuando exista el entorno, con verificación explícita de todo lo que sí se puede verificar sin Android.

**Por qué `react-native-launcher-kit` y no un módulo nativo propio**: escribir Kotlin a mano (vía `expo-modules-api`) que nunca corre ni una sola vez en este entorno es mucho más riesgoso que depender de una librería de terceros mantenida, compatible con New Architecture, ya usada por otros proyectos Expo -- si algo falla, falla en código con sus propios usuarios y su propio CI, no en código que solo esta sesión escribió y jamás ejecutó. `react-native-launcher-kit@3.0.0` expone `InstalledApps.getSortedApps()` sobre `PackageManager` de Android, soporta dev client de Expo explícitamente (no Expo Go, ya que es código nativo).

**Permiso de manifest vía config plugin, no edición manual**: `QUERY_ALL_PACKAGES` (requerido en Android 11+ para ver paquetes fuera de la "package visibility" por defecto) se inyecta con un plugin local (`apps/mobile/plugins/withQueryAllPackagesPermission.js`, usa `@expo/config-plugins`' `withAndroidManifest`/`AndroidConfig.Permissions.ensurePermissions`) registrado en `app.json`, no editando `android/app/src/main/AndroidManifest.xml` a mano -- ese archivo se regenera en cada `expo prebuild` y perdería el permiso.

**Modelo de datos: reutilizar `BlockListEntry`, no inventar un concepto nuevo**: el picker crea/borra entradas `kind: 'MOBILE_APP'`, `platform: 'ANDROID'`, `identifier` = nombre de paquete, sobre el mismo modelo unificado que ya usa el panel de bloqueo de la web (decisión de diseño original de la fase 5: bloqueo es un solo modelo con `kind`, no conceptos separados por plataforma). Una entrada creada desde el picker de Android aparece igual en la web y viceversa, a través del mismo pipeline `/sync/pull`+`/sync/batch` que ya usan tareas/fitness/pomodoro en móvil.

**Qué se verificó y qué no**: typecheck y lint limpios. Vía `expo start --web` + Playwright: la pantalla monta sin errores, el fallback "no disponible en web" se muestra en vez del picker (prueba que el guard de `Platform.OS` funciona y que el módulo nativo no rompe el bundle web), y el listado/borrado de entradas existentes -- que no toca el módulo nativo en absoluto -- funciona de punta a punta contra el servidor real (entrada `hardMode` creada vía API, renderizada con las badges correctas, borrada por la UI con el `window.confirm` de texto reforzado disparando correctamente). Lo que **no** se pudo verificar, y no se puede desde este entorno: si el módulo nativo de `react-native-launcher-kit` efectivamente linkea/compila bajo `expo prebuild`, si el plugin de permiso produce un manifest fusionado válido, y si `getSortedApps()` devuelve datos reales en un dispositivo o emulador real. Eso queda pendiente para la próxima vez que este repo se abra en un entorno con el SDK de Android instalado.

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
