# Cómo trabaja la IA en el flujo de la app

Este documento explica qué hace cada modelo, cuándo actúa y qué datos deja para mejorar la
próxima vez. El criterio de fondo está en [normas-de-atencion.md](normas-de-atencion.md).

**Regla general:** los modelos **clasifican y proponen**; el **código decide** lo que es regla
(minutos, capacidad, orden); **tú apruebas** lo que cambia el calendario.

## El ciclo de una semana

```
  ┌─ 1. Tareas nuevas ──┐   ┌─ 2. Etiquetar ─────┐   ┌─ 3. Planear (viernes) ┐
  │ vault (pensum),     │ → │ R, C → perfil      │ → │ Gemini propone,       │
  │ app                 │   │ (anclas / Gemini)  │   │ el validador filtra,  │
  └─────────────────────┘   └────────────────────┘   │ tú aceptas            │
            ▲                                         └──────────┬────────────┘
            │                                                    ▼
  ┌─ 6. Aprender ───────────────┐   ┌─ 5. Medir ─────────┐   ┌─ 4. Hacer ──────────────┐
  │ calibrar perfiles (código), │ ← │ FocusEvent: todo   │ ← │ notificación al inicio, │
  │ re-etiquetar, entrenar Laya │   │ lo que pasó        │   │ pomodoro por perfil     │
  └─────────────────────────────┘   └────────────────────┘   └─────────────────────────┘
```

### 1. Tareas nuevas

Entran desde el vault (`scripts/import-study-notes.mjs`, **una tarea por sesión de 90
minutos**) o desde la app. Ningún modelo interviene en este paso.

### 2. Etiquetar (al crear la tarea, o en lote antes de planear)

- Si la tarea está en [anclas.json](anclas.json), se usa esa etiqueta (`REFERENCE`).
- Si no, **Gemini** recibe las normas y unas 20 anclas como ejemplo, y devuelve tipo, R, C y una
  frase de por qué (`MODEL`). En la prueba acertó el perfil exacto en el 81 % de los casos y nunca
  se equivocó por más de un nivel.
- El **código** saca el perfil con la tabla R×C. Ningún modelo calcula minutos.
- **Tú** puedes cambiar el perfil en la app (`USER`), y tu cambio siempre gana.

### 3. Planear (el bloque del viernes "plan de la semana", o cuando lo pidas)

- **Gemini** reparte las tareas en bloques siguiendo tus reglas (`Prompt_app_calendario.md`) y
  las de las normas: lo profundo en la mañana, como mucho dos bloques profundos por día.
- El **validador** rechaza lo inválido: un bloque sobrecargado, un orden de pensum roto o un
  bloque que no es de trabajo.
- **Tú** aceptas o descartas cada asignación. Nada entra al calendario sin tu aceptación.
- Si Gemini no responde, el plan lo hace el planificador heurístico, y la propuesta lo avisa.

### 4. Hacer: el celular

- Al inicio de cada bloque llega una notificación con "Iniciar", "En 5 min" y "Hoy no".
- **Iniciar** arranca el pomodoro con el perfil del bloque, que es el de su tarea más exigente,
  sobre la primera tarea del bloque. Un bloque mecánico dura 60 minutos; uno ligero o profundo,
  90. El bloque termina a su hora fija: si empiezas tarde, salen menos pomodoros y el último se
  recorta.

### 5. Medir: todo queda en `FocusEvent`

| Evento | Qué guarda |
|---|---|
| `BLOCK_PROMPT_ACCEPTED` / `SNOOZED` / `DECLINED` / `OPENED` | tu respuesta a la notificación, **cuántos segundos tarde** respondiste, cuántas veces la pospusiste, el perfil y la tarea |
| `FOCUS_STARTED` / `FOCUS_COMPLETED` | cada pomodoro y cuánto duró de verdad |
| `BREAK_COMPLETED` | cada pausa |
| `SESSION_CANCELLED` | cuándo lo cortaste: en qué fase, después de cuántos pomodoros, y si fue a mano o por abandono |
| `BLOCK_ENDED` | el bloque llegó a su hora y cuántos pomodoros se hicieron |
| `CHECK_IN` | los minutos de concentración real que reportaste (todavía falta en el celular) |

Además, `BlockEvent` (tarea 8.2) ya guarda cada intento de abrir una app bloqueada, con la hora.
Cruzando las horas se sabe **cuántas veces quisiste salirte durante cada pomodoro**.

Un bloque sin ningún evento significa que **ignoraste** la notificación. No se guarda porque se
puede deducir.

### 6. Aprender (cada semana, antes de planear)

Va de lo más barato a lo más caro:

1. **Calibración (solo código):** el largo de cada perfil se ajusta a la mediana de tus check-ins
   recientes, dentro de su rango y con un techo de 50 minutos.
2. **Sugerencias de re-etiquetado (solo código):** una tarea que cortas siempre antes de tiempo, o
   en la que intentas abrir apps bloqueadas una y otra vez, recibe la sugerencia de bajar un
   perfil. Tú decides.
3. **Contexto para Gemini:** al planear recibe un resumen de la semana anterior: a qué hora
   empiezas de verdad, qué bloques sueles rechazar y qué perfiles aguantas.
4. **Entrenar a Laya:** cuando haya unas 150 tareas etiquetadas y medidas (anclas, más lo que
   etiquete Gemini, más tus correcciones), se le hace fine-tuning en tu RTX 5080. Desde ahí
   etiqueta al instante y sin conexión, y Gemini queda solo para planear.
5. **Revisión con un modelo grande (de vez en cuando):** revisa los casos donde Laya, Gemini y tú
   no coinciden, y actualiza las normas y las anclas.

## Qué está hecho y qué falta (al 2026-10-01)

- [x] Perfiles y reparto del bloque (`packages/shared/src/attention`), con el pomodoro en modo bloque.
- [x] `FocusEvent` en el servidor, con registro en el celular, la web y el escritorio.
- [x] Aviso al inicio de cada bloque en el celular (notificación por fecha con el horario real y el
  perfil del día), con sus tres acciones.
- [x] Aviso al inicio de cada bloque en el escritorio y la web (notificación del sistema y ventana
  con Iniciar / En 5 min / Hoy no).
- [x] **La IA entra sola al crear una tarea:** el servidor la califica unos 15 segundos después de
  que llega (etiqueta de referencia o Gemini).
- [x] Estructurar una tarea suelta con Gemini (`POST /planning/structure`).
- [x] **Plan de la semana:** el viernes, en el bloque "plan de la semana", el celular avisa y abre
  la pantalla del plan, donde aceptas o descartas cada asignación (también desde el inicio).
- [x] Barra con el pomodoro en curso, visible en todas las pantallas del celular.
- [ ] Importar el pensum con una tarea por sesión.
- [ ] Check-in de concentración en el celular, guardado por perfil.
- [ ] Calibración y sugerencias de re-etiquetado.
- [ ] Dataset y fine-tuning de Laya: sin entrenar acierta el 45 % de los perfiles.
