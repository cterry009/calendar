# Tareas

Cada función visible se entrega para revisión (qué hace, cómo probarla en ≤ 2 min desde el chat y
desde la interfaz, supuestos, "¿coincide con lo que planeas?") y no se sigue hasta la respuesta.
Al cerrar cada fase: entrada en la bitácora del proyecto "App de calendario y tutor adaptativo".

## Fase 1 — problemas 1 a 5

### 1. Base: operaciones, historial, idempotencia
- [ ] 1.1 Migración: `AgentOperation`, `AgentChange`, `ScheduleCompletionStatus.PARTIAL`, `ScheduleCompletion.progress`. Verificar: `prisma migrate deploy` en una base de prueba; sync de completados acepta PARTIAL.
- [ ] 1.2 `server/src/agent-ops`: `POST /agent/ops/preview`, `POST /agent/ops/:id/apply`, `POST /agent/ops/:id/undo`, `GET /agent/ops` (historial). Aplica por `processBatch` en transacción, rechaza planes obsoletos, idempotencia por clave. Verificar: `server/test/agent-ops.test.ts`.
- [ ] 1.3 MCP: cliente de operaciones (vista previa → `confirmar`), formato común de antes/después; `historial` y `deshacer`. **Entrega para revisión.**

### 2. Tareas
- [ ] 2.1 `editar_tarea` (todos los campos, fecha "mañana 9:00" o YYYY-MM-DD HH:MM). Shared: validación y normalización. **Entrega.**
- [ ] 2.2 `eliminar_tareas` (archivar / eliminar, vista previa). **Entrega** (con las tareas de prueba como caso real).
- [ ] 2.3 Shared `planShiftDay` + pruebas; `correr_dia`. **Entrega.**
- [ ] 2.4 Shared `planRescheduleOverdue` (reglas hoy, manana, repartir, por_prioridad, archivar_viejas) + pruebas; `reprogramar_atrasadas`. **Entrega.**
- [ ] 2.5 Shared `findDuplicateTasks` / `planMergeTasks` + pruebas; `duplicados` (fusionar al confirmar). Guardia anti-duplicados e idempotencia en `crear_tarea`. **Entrega** (limpiando los duplicados reales contigo).

### 3. Registro y bloques del día
- [ ] 3.1 `registrar_energia` → `/checkins` (idempotente por clientId; horas 9/11/13/15/17 mapean al check-in fijo). **Entrega.**
- [ ] 3.2 `marcar_bloque` (hecho/saltado/parcial con %, razón); la app muestra el estado y la razón; `patrones` ya los lee. **Entrega.**
- [ ] 3.3 `mover_bloque` (solo un día, por excepción). **Entrega.**

### 4. `hoy` con triage
- [ ] 4.1 Nuevo formato: bloques con estado, tareas de hoy, atrasadas resumidas (total + 5 + "limpia 3"), hábitos, energía de hoy. Pruebas con snapshot fijo. **Entrega.**
- [ ] 4.2 Bitácora de la fase 1.

## Fase 2 — bloques y horario (se detalla al aprobar la fase 1)
- [ ] 5.1 Propuesta detallada del catálogo `BlockType`, `DayBlock` y asignación de tareas (migración de categorías existentes).
- [ ] 5.2 `tipos_bloque`, `horario`, `editar_bloque` (dia/plantilla), `asignar_tareas`.
- [ ] 5.3 Shared `planRestructureDay` + pruebas; `reestructurar_dia`.

## Fase 3 — registro del día
- [ ] 6.1 `DayNote`, `nota_dia`, `cerrar_dia`; razones unificadas en `patrones`.

## Fase 4 — CRUD completo
- [ ] 7.1 `editar_habito`; `actualizar_proyecto` con eliminar/completar; eventos (`Task.kind`, `evento`).

## Fase 5 — estilo
- [ ] 8.1 `UserSettings.appearance` sincronizado; la web lo aplica; `estilo`.

## Fase 6 — ideas
- [ ] 9.1 Plan semanal automático (domingo, con vista previa), sugerencias según `patrones`, resumen de fin de día programado.

## Decisiones del 13 nov (aprobadas por Cristo)

- Escrituras simples (un registro) se aplican directo; las grandes (lote, fusión, reestructurar, eliminar definitivo, cambiar la plantilla) muestran vista previa y piden confirmación. Todo queda en el historial y se puede deshacer.
- Archivar = borrado recuperable. Lo archivado se revisa en la revisión del domingo (la app y Claude avisan); lo que no se revise se elimina definitivamente.
- Claude infiere la acción del lenguaje natural ("junta los dos bloques de estudio" → unir).
- Jerarquía: bloque (franja del horario) ⊃ evento/sesión (tarea con hora fija y duración, de un tipo de bloque) ⊃ pomodoros. Evento fuera de su bloque → preguntar por qué y ofrecer cambiar el horario o mover el otro bloque.

## Ajustes de interfaz aprobados (fuera de las fases, 13 nov)

- [ ] A.1 R3 · Hoy: arreglar marcar tareas como hechas (no funciona).
- [ ] A.2 R3 · Hoy: tareas en secciones colapsables — Hoy (abierta), Atrasadas (colapsada, con "limpiar 3"), Sin asignar (colapsada, subgrupos por proyecto/etiqueta, alta prioridad primero).
- [ ] A.3 R1 · "Bloqueo" pasa a "Apps bloqueadas": lista de lo ya bloqueado; al bloquear, duración (1 h, 3 h, 6 h, 1 día, 1 semana, 1 mes); desbloquear antes de tiempo abre un chat integrado donde un agente con contexto decide si es emergencia.
- [ ] A.4 R2 · Etiquetas: además de las libres, una lista sugerida por área (se puede elegir de la lista o escribir una nueva).
- [ ] A.5 "Ya lo domino": se desbloquea al aprobar el nivel (o un mínimo); se puede seguir practicando y el tema solo se retira cuando Cristo pulsa "Ya lo domino".
- [ ] A.6 Ventana nocturna fines de semana: empieza a las 12 (confirmar si es 00:00).
- [ ] A.7 Radares en la app: opción (a), cambio research-tracking (las tareas programadas escriben programas, investigadores y fechas de cierre en la base de la app).
