# Spec Delta

## MODIFIED Requirements

### Requirement: Escrituras con paridad
El puente SHALL poder hacer, para tareas, bloques del día, registros de energía, hábitos, proyectos,
eventos y estilo, todo lo que la interfaz permite, a través de operaciones del servidor que aplican
los cambios con las mismas reglas de dominio que la interfaz (`processBatch`). SHALL NOT escribir
en la base de datos por ningún otro camino.

#### Scenario: Cambiar la fecha de una tarea
- **WHEN** Claude llama `editar_tarea` con una tarea y una nueva fecha
- **THEN** la misma tarea cambia de fecha, no se crea otra, y la app la muestra en el día nuevo

## ADDED Requirements

### Requirement: Vista previa de operaciones en lote y destructivas
Correr el día, reprogramar atrasadas, fusionar, eliminar, reestructurar y los cambios de plantilla
SHALL devolver primero una vista previa (antes, después, avisos y un id) y SHALL aplicarse solo
cuando se llamen con `confirmar` igual a ese id. Si algún registro cambió desde la vista previa, la
operación SHALL rechazarse sin aplicar nada.

#### Scenario: Correr el día
- **WHEN** Claude llama `correr_dia` del jueves al viernes sin `confirmar`
- **THEN** recibe la lista de tareas que pasarían y nada cambia
- **WHEN** vuelve a llamar con `confirmar` igual al id recibido
- **THEN** esas tareas quedan el viernes y no hay duplicados

### Requirement: Historial y deshacer
Cada escritura hecha por el puente SHALL quedar registrada con quién, qué, cuándo y los valores
anteriores y nuevos de cada registro, y SHALL poder revertirse por operación. Un registro editado
después desde la interfaz SHALL omitirse al deshacer, con aviso.

#### Scenario: Deshacer una fusión
- **WHEN** Claude fusiona tres "Tabla de maestrías" en una y luego llama `deshacer`
- **THEN** vuelven las tres tareas como estaban

### Requirement: Idempotencia
Toda escritura SHALL llevar una clave de idempotencia; repetir una llamada con la misma clave SHALL
devolver el resultado original sin volver a aplicar cambios.

#### Scenario: Llamada repetida
- **WHEN** `crear_tarea` se llama dos veces con los mismos datos el mismo día
- **THEN** existe una sola tarea

### Requirement: Hoy con triage
`hoy` SHALL separar las tareas de hoy de las atrasadas, resumir las atrasadas (total y las cinco más
importantes) y, si hay muchas, sugerir limpiar tres antes de agregar.

#### Scenario: Muchas atrasadas
- **WHEN** hay 15 tareas atrasadas y 4 para hoy
- **THEN** `hoy` muestra las 4 de hoy, "15 atrasadas" con las 5 más importantes y la sugerencia de limpieza

### Requirement: Registro del día desde el chat
El puente SHALL registrar la energía (0–100) con su hora, y marcar un bloque de un día como hecho,
saltado o parcial con su razón, de modo que `patrones` los use.

#### Scenario: Bloque saltado
- **WHEN** Claude marca el bloque de las 9:00 como saltado con razón "me levanté tarde"
- **THEN** la app muestra el bloque saltado con esa razón y `patrones` la cuenta
