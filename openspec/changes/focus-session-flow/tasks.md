# Tasks

## 1. Shared

- [x] 1.1 `MIN_FOCUS_TO_END = 0.75` and a `canEndFocus(session, now)` guard (`pomodoro/focusGuard.ts`), applied by the apps to their end controls; the state machine's transitions stay as they are so an end synced from another device still applies. Verify: Jest tests (10/30 refused, 23/30 allowed, paused time not counted, pauses unaffected).
- [ ] 1.2 `suggestNextPomodoro(...)` by block kind (study section, project next step, next task, category labels) with the energy length rules. Verify: Jest tests per kind.
- [ ] 1.3 `sessionCounters(...)` over sessions, focus events, attempts, tasks and log entries. Verify: Jest tests per kind.

## 2. Apps

- [ ] 2.1 Web/desktop controls: end disabled with "faltan N min", only "Pausar" before 75 %; suggestion card after a focus; counters in the session and its summary. Verify: Vitest for the control state; tried in a block.
- [ ] 2.2 Phone: the same controls, suggestion and counters; native overlay end action guarded if it has one. Verify: tried on the phone (relaunch with monkey, check accessibility).

## 3. Revisión (feature-review-gate)

Each feature reaches Cristo as a review card (what it does, how to try it in ≤ 2 min, the assumptions taken) and is checked off only with his answer.

- [ ] 3.1 Cristo revisó no poder terminar un pomodoro antes del 75 % (solo pausar): coincide / cambiar / quitar. Verify: his answer recorded here; "cambiar" becomes a task in this change.
- [ ] 3.2 Cristo revisó la sugerencia del siguiente pomodoro: coincide / cambiar / quitar. Verify: his answer recorded here; "cambiar" becomes a task in this change.
- [ ] 3.3 Cristo revisó los contadores por sesión en todos los tipos de bloque: coincide / cambiar / quitar. Verify: his answer recorded here; "cambiar" becomes a task in this change.
