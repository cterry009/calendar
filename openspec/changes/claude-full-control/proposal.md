# Propuesta: manejar la app completa desde Claude

## Por qué

Cristo quiere manejar el calendario entero desde un chat de Claude (2026-11-13). El puente MCP
`calendario` hoy lee bien pero escribe poco, y el uso real ya dejó daño:

1. No se puede cambiar la fecha de una tarea: "correrla" creó duplicados ("Tabla de maestrías",
   "CV académico v1", "Escribir reporte semanal", dos o tres veces cada una).
2. No se puede registrar la energía ni los registros de 9/11/13/15/17.
3. No se puede marcar un bloque como saltado con su razón, ni mover o reestructurar los bloques del día.
4. `hoy` devuelve 21 tareas: mezcla atrasadas y de hoy sin triage.
5. Hay tareas de prueba vivas y no hay cómo eliminarlas.

La interfaz y el servidor ya saben hacer casi todo eso (sync de tareas, bloques, excepciones del
día, completados de bloque con razón, check-ins, hábitos). Lo que falta es exponerlo a Claude con
seguridad: vista previa, deshacer e idempotencia.

## Qué cambia

1. **Operaciones de Claude en el servidor (`agent-ops`).** Un módulo nuevo que recibe operaciones
   de alto nivel (editar, correr el día, fusionar, reestructurar…), calcula un plan con funciones
   puras de `@calendar/shared`, lo devuelve como vista previa y, al confirmarlo, lo aplica a través
   de `SyncService.processBatch`: las mismas reglas de dominio que la interfaz, nunca SQL directo.
2. **Historial y deshacer.** Cada escritura de Claude queda en `AgentOperation` y `AgentChange`
   (quién, qué, cuándo, valores anteriores y nuevos) y se puede revertir por operación.
3. **Idempotencia.** Toda escritura lleva una clave; repetirla devuelve el mismo resultado.
4. **Herramientas MCP nuevas y cambiadas**, pocas y con parámetros claros (ver design.md).
5. **Esquema**, por fases y con migraciones:
   - Fase 1: `AgentOperation`, `AgentChange`; estado `PARTIAL` y `progress` en `ScheduleCompletion`.
   - Fase 2: `BlockType` (catálogo de bloques), `Schedule.blockTypeId`, `DayBlock` (bloque de un
     solo día), `Task.scheduleId` + `Task.blockDate` (tarea asignada a un bloque).
   - Fase 3: `DayNote` (notas del día).
   - Fase 4: `Task.kind` (TASK | EVENT) y `Task.durationMinutes` para eventos.
   - Fase 5: `UserSettings.appearance` (estilo guardado como configuración, sincronizado).

## Fases

| Fase | Resuelve | Contenido |
|---|---|---|
| 1 | Problemas 1–5 | agent-ops + historial + deshacer; editar/eliminar/archivar tareas; correr el día; reprogramar atrasadas; duplicados y fusión; registrar energía; marcar bloque con razón; mover un bloque un día; `hoy` con triage |
| 2 | Bloques y horario | catálogo de tipos de bloque; plantillas por día y cambios de un solo día; mover/partir/unir/intercambiar; reestructurar el día; asignar tareas a bloques |
| 3 | Registro del día | notas del día; razones unificadas para `patrones`; resumen de fin de día |
| 4 | CRUD completo | hábitos (crear, editar, pausar, eliminar, metas); proyectos (eliminar, completar); eventos |
| 5 | Estilo | leer y cambiar tema, paleta, tipografía, densidad y colores por área/categoría |
| 6 | Ideas | plan semanal automático, sugerencias por patrones, guardia anti-duplicados al crear |

## Fuera de alcance

- El bloqueo de distracciones, la ventana nocturna y el compromiso: siguen siendo solo de la app.
- Cambios de código del frontend desde Claude: el estilo se cambia como configuración, no editando archivos.
- Móvil: recibe los cambios por sync como hoy; no se rediseña nada allí.

## Capacidades

- Modificada: `claude-bridge` (escrituras completas, vista previa, deshacer, idempotencia).
- Nuevas en fases 2 y 5: `block-types`, `appearance-settings`.
