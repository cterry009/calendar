# Diseño

## 1. Arquitectura

```
Chat de Claude ──MCP──▶ services/claude-mcp (herramienta)
                           │  POST /agent/ops/preview   { tipo, parámetros, claveIdempotencia }
                           ▼
              server/src/agent-ops ── plan = f(snapshot)   ← funciones puras en packages/shared/src/agent-ops
                           │  guarda AgentOperation(status PREVIEW, plan, expira 15 min)
                           ◀─ antes / después + operacionId
                           │  POST /agent/ops/:id/apply
                           ▼
              SyncService.processBatch(cambios del plan)   ← mismas reglas que la interfaz
                           │  AgentChange por registro (before, after)
                           ▼
              sync:changes → la app y el móvil se actualizan en vivo
```

- **La lógica vive en `packages/shared`** (pura, con pruebas): `planShiftDay`, `planRescheduleOverdue`,
  `findDuplicateTasks`, `planMergeTasks`, `planMoveBlock`, `planSplitBlock`, `planRestructureDay`…
  Reciben el snapshot y los parámetros y devuelven `{ cambios, antes, después, avisos }`.
- **El servidor solo orquesta**: carga el snapshot del usuario, llama la función, guarda el plan, y
  al aplicar envía `cambios` por `processBatch` dentro de una transacción.
- **Plan obsoleto**: al aplicar, si algún registro cambió (`updatedAt` distinto al del plan), la
  operación se rechaza con "cambió algo desde la vista previa, vuelve a pedirla". Nunca se aplica
  un plan viejo a medias.

## 2. Vista previa y confirmación

- Las operaciones **en lote o destructivas** (correr el día, reprogramar, fusionar, eliminar,
  reestructurar, partir/unir/intercambiar en la plantilla) devuelven primero la vista previa:
  `operacionId`, resumen en una línea, tabla antes → después y avisos. Solo se aplican con
  `confirmar: "<operacionId>"`.
- Las **escrituras simples de un registro** (editar una tarea, registrar energía, marcar un bloque,
  mover un bloque un solo día) se aplican directo, pero igual quedan en el historial y se pueden deshacer.
- La herramienta MCP tiene un solo parámetro para esto: `confirmar?: string`. Sin él, en las
  operaciones en lote siempre se obtiene la vista previa.

## 3. Historial y deshacer

```
AgentOperation  id, userId, deviceId, kind, idempotencyKey, status (PREVIEW|APPLIED|UNDONE|EXPIRED|REJECTED),
                summary, params Json, plan Json, createdAt, expiresAt, appliedAt, undoneAt
                @@unique([userId, idempotencyKey])
AgentChange     id, operationId, entity, recordId, before Json?, after Json?, createdAt
```

- `deshacer` construye el cambio inverso de cada `AgentChange` (crear → borrado suave; editar →
  valores de `before`; borrar → restaurar) y lo envía por `processBatch`. El deshacer es a su vez
  una operación (kind `undo`), así que también se puede ver en el historial.
- Si un registro se editó después desde la interfaz, deshacer ese registro se omite y se avisa
  ("lo cambiaste después en la app; no lo toqué").
- Los registros de operación se guardan 60 días.

## 4. Idempotencia

- Cada llamada que escribe envía `claveIdempotencia` (el MCP la deriva de la herramienta y los
  parámetros normalizados más el día, o usa la que Claude pase). Si ya existe una operación con esa
  clave, se devuelve su resultado sin aplicar nada.
- `crear_tarea` pasa a usar la clave y además avisa si ya hay una tarea abierta con título casi
  igual (similitud ≥ 0,85) y no la crea salvo que se pida explícitamente.

## 5. Herramientas MCP

Pocas, en español, cada una con "cuándo usarla" en su descripción. **(N)** nueva, **(C)** cambiada.

### Fase 1 (problemas 1–5)
| Herramienta | Qué hace | Vista previa |
|---|---|---|
| `hoy` (C) | Bloques del día con su estado; tareas **de hoy**; **atrasadas** resumidas (total, 5 más importantes, sugerencia de limpiar 3); hábitos; energía registrada | — |
| `editar_tarea` (N) | Cambia cualquier campo: título, fecha y hora, prioridad, estimación, proyecto, descripción, estado | no (deshacer sí) |
| `eliminar_tareas` (N) | Archiva (estado CANCELLED) o elimina (borrado suave) una o varias tareas | sí |
| `correr_dia` (N) | Pasa todo lo pendiente de una fecha a otra, conservando la hora, sin duplicar | sí |
| `reprogramar_atrasadas` (N) | Regla: `hoy`, `manana`, `repartir` (N por día según su estimación y los huecos), `por_prioridad` (alta hoy, media mañana, baja la próxima semana) o `archivar_viejas` (> N días) | sí |
| `duplicados` (N) | Encuentra grupos de tareas duplicadas y propone cuál conservar (la más reciente o la que tenga más datos); fusiona al confirmar (copia lo que falte y borra las demás) | sí |
| `registrar_energia` (N) | Energía 0–100 a una hora (por defecto ahora; acepta 9/11/13/15/17), siesta, intensidad del ejercicio, avance y nota → `CheckIn` | no |
| `marcar_bloque` (N) | Hecho, saltado o parcial (con %) con razón, para un bloque de un día → `ScheduleCompletion` | no |
| `mover_bloque` (N) | Mueve, cambia la duración o la categoría de un bloque **solo ese día** → `ScheduleException` | no |
| `historial` (N) | Últimas operaciones de Claude con su estado | — |
| `deshacer` (N) | Revierte una operación (por id) o la última | sí |

### Fase 2 (bloques y horario)
| `tipos_bloque` (N) | Lista, crea o edita tipos: nombre, color, duración por defecto, categoría, reglas (juego en pausas, tutor, página asociada, cuenta para metas) |
| `horario` (N) | Lee la plantilla de un día de la semana y los cambios de una fecha concreta |
| `editar_bloque` (N) | `accion`: mover, duracion, partir, unir, intercambiar, crear, eliminar; `alcance`: `dia` (solo esa fecha) o `plantilla` |
| `reestructurar_dia` (N) | A partir de una instrucción ("perdí la mañana") y la hora actual, recoloca lo que queda por prioridad y por tus mejores horas (`patrones`) |
| `asignar_tareas` (N) | Asigna tareas concretas a un bloque de un día |

### Fase 3–5
| `nota_dia` (N) | Lee o escribe las notas del día |
| `cerrar_dia` (N) | Resumen de fin de día: bloques hechos/saltados y razones, energía, tareas cerradas; propone qué correr a mañana |
| `editar_habito` (N) | Crear, editar, pausar, archivar, eliminar, cambiar metas y recordatorios |
| `actualizar_proyecto` (C) | + eliminar y completar |
| `evento` (N) | Crear, mover o eliminar eventos (hora fija y duración) |
| `estilo` (N) | Lee o cambia tema, paleta, tipografía, densidad y colores por área/categoría |

Total al final: 17 herramientas actuales + 19 nuevas = 36, agrupadas por recurso.

## 6. Esquema por fase

- **Fase 1**: `AgentOperation`, `AgentChange`; `ScheduleCompletionStatus.PARTIAL`; `ScheduleCompletion.progress Int?`.
  La razón de un bloque ya existe (`ScheduleCompletion.reason`).
- **Fase 2**: `BlockType { id, userId, key, name, color, defaultMinutes, category, rules Json, archived }`;
  `Schedule.blockTypeId?` (migración que crea un tipo por cada `category` existente y los enlaza);
  `DayBlock { id, userId, date, startMinute, endMinute, blockTypeId, label, sequence? }` para partir
  o crear un bloque de un solo día; `Task.scheduleId?` y `Task.blockDate?`.
- **Fase 3**: `DayNote { id, userId, date, text, source }` @@unique([userId, date]).
- **Fase 4**: `Task.kind (TASK|EVENT)`, `Task.durationMinutes?`.
- **Fase 5**: `UserSettings { userId, appearance Json, updatedAt }`; la web lo lee y deja localStorage solo como caché.

Todo lo nuevo que deba verse en la app se sincroniza por `/sync/pull` y `/sync/batch` como lo demás.

## 7. Decisiones y alternativas descartadas

- **Herramientas por recurso con `accion`** (p. ej. `editar_bloque`) en vez de una por verbo: menos
  herramientas casi iguales, descripciones más claras.
- **Plan calculado en el servidor, no en el MCP**: así la vista previa y la aplicación usan los
  mismos datos y la misma versión de la lógica, y la interfaz podrá usar los mismos endpoints
  (por ejemplo, un botón "correr el día").
- **Sin escritura directa a la base**: todo pasa por `processBatch` para que valgan las reglas,
  las notificaciones en vivo y los conflictos por `updatedAt`.
- **Archivar = CANCELLED**: ya existe en `TaskStatus`; no hace falta un campo nuevo.

## 8. Pruebas

- `packages/shared`: cada función de plan con casos normales y de borde (día vacío, tareas sin
  hora, choques, tareas completadas que no se tocan, zona horaria America/Bogota alrededor de medianoche).
- `server/test/agent-ops.test.ts`: vista previa no escribe; aplicar escribe y registra `AgentChange`;
  plan obsoleto se rechaza; misma clave = mismo resultado; deshacer revierte y omite lo editado después.
- MCP: pruebas contra un snapshot fijo para el formato de `hoy` y de las vistas previas.
