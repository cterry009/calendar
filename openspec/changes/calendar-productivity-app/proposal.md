## Why

Las herramientas de calendario actuales planifican el tiempo pero no ayudan a ejecutar con foco ni a aprender de los patrones reales de productividad y bienestar. Se necesita una aplicación unificada —disponible en móvil y computador— que combine planificación inteligente, protección contra distracciones, seguimiento de deporte y analítica accionable para mejorar día a día.

## What Changes

- Crear una aplicación multiplataforma (Android, iOS, Windows, macOS, web) con experiencia consistente entre dispositivos.
- Añadir calendario con tareas que incluyen dificultad, complejidad y estimación de tiempo.
- Configurar horarios de trabajo y descanso que guíen la planificación automática.
- Integrar pomodoros vinculados a tareas y sesiones de foco.
- Implementar bloqueo de distracciones: apps en móvil y sitios/aplicaciones en escritorio durante tareas, pomodoros u horarios de trabajo.
- Mostrar estadísticas de progreso (tiempo planificado vs real, pomodoros, tareas por dificultad) con sugerencias de mejora.
- Registrar y visualizar estadísticas de deporte, con correlación opcional respecto a la productividad.
- Añadir **Modo Control de Serotonina**: reducir estímulos digitales de alta dopamina y promover actividades que apoyan el equilibrio serotoninérgico (luz solar, ejercicio, conexión social, meditación, lectura, journaling).
- Sincronizar datos entre dispositivos mediante cuenta de usuario y backend en la nube.

## Capabilities

### New Capabilities

- `calendar-scheduling`: Vistas de calendario (día/semana/mes), horarios de trabajo y ventanas de descanso.
- `task-management`: CRUD de tareas con dificultad, complejidad, tiempo estimado/real, prioridad y categorías.
- `pomodoro-timer`: Sesiones pomodoro configurables ligadas a tareas y horarios de foco.
- `focus-blocking`: Bloqueo de apps (móvil) y sitios/aplicaciones (escritorio) durante foco, pomodoros o jornada laboral.
- `progress-analytics`: Dashboard de métricas de productividad y sugerencias automáticas de mejora.
- `fitness-tracking`: Registro manual e integración con Health/Fit para métricas deportivas.
- `serotonin-control`: Modo bienestar que reduce inputs digitales de alta dopamina, guía rituales breves y rastrea pilares de presencia (sol, ejercicio, meditación, lectura, journaling, conexión social).
- `cross-platform-sync`: Cuenta de usuario, sincronización en tiempo real y sesiones activas entre móvil y escritorio.

### Modified Capabilities

_(ninguna — proyecto greenfield)_

## Impact

- **Nuevo monorepo** con clientes móvil (React Native o Flutter), escritorio (Electron o Tauri) y API backend.
- **Backend**: API REST/GraphQL, base de datos relacional, autenticación, motor de sincronización y jobs de analítica.
- **Permisos de sistema**: uso de apps/accesibilidad (Android), Screen Time (iOS, limitado), hosts file / extensiones o agente de sistema (escritorio).
- **Integraciones externas**: Apple Health, Google Fit, opcionalmente Google Calendar.
- **Infraestructura**: hosting cloud, almacenamiento de datos de usuario, notificaciones push.
