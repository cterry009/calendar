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
