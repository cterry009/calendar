# Tasks

## 1. Look and home

- [ ] 1.1 Agenda modes as default for users with no stored choice, following the OS light/dark (`AppearanceContext`). Verify: Vitest for the default resolution.
- [ ] 1.2 `HoyPage` as `/`: current/next block with one primary action, today's tasks and habits, next items. Verify: Vitest for "what is current/next"; tried in the app at a block time.
- [ ] 1.3 Navigation trimmed to the routine destinations; the rest under "Más". Verify: every page still reachable; tried.

## 2. Timetable and sync status

- [ ] 2.1 Horario as a week grid (category color, title, flexible suggestion times). Verify: tried with the user's real timetable.
- [ ] 2.2 Pending template updates reviewed and applied in one step (the current "Actualizar las tardes" and future ones). Verify: diff shown before applying; tried.
- [ ] 2.3 Sync status indicator from the offline queue and the socket. Verify: Vitest for the state mapping; tried with the API stopped and restarted.

## 3. Study section

- [ ] 3.1 "Ocultar tiempo" switch (per device) keeping timing, records and notices. Verify: a focus segment ends with the clock hidden and the pause starts.
- [ ] 3.2 Per-session progress (shared function over sessions, focus events and exercise attempts) and its view. Verify: Jest tests for the function; summary seen after a block.
- [ ] 3.3 Bar to the next section (level toward mastery, unlock at mastery + 5 exercises, next block starts there). Verify: Jest tests for the unlock rule; bar seen filling during a session.

## 4. Reasoning progress

- [ ] 4.1 Tutor: `stream-json` output mapped to short Spanish details and sent as `tutor:progress` to the requesting device; "Pensando… N s" counter in the app; final answer path unchanged. Verify: server test with a fake stream; details seen in the app.
- [ ] 4.1b Time estimate: store each turn's duration and kind; median of the last 20 (≥ 3 samples) returned with the turn and shown. Verify: tests for the median and the 3-sample rule.
- [ ] 4.2 Planner proposal: same progress display. Verify: steps seen while proposing a plan.

## 5. Full-screen mode

- [ ] 5.1 `/enfoque` layout with tiles and keyboard navigation; Esc returns. Verify: Vitest for key navigation; tried.
- [ ] 5.2 Desktop: F11 and `--fullscreen` toggle native full screen. Verify: tried on the desktop app.

## 6. Phone

- [ ] 6.1 Agenda tokens on mobile (after 1-5). Verify: tried on the phone.

## 7. Revisión (feature-review-gate)

Each feature reaches Cristo as a review card (what it does, how to try it in ≤ 2 min, the assumptions taken) and is checked off only with his answer.

- [ ] 7.1 Cristo revisó el diseño Agenda por defecto: coincide / cambiar / quitar. Verify: his answer recorded here; "cambiar" becomes a task in this change.
- [ ] 7.2 Cristo revisó Hoy como pantalla de inicio: coincide / cambiar / quitar. Verify: his answer recorded here; "cambiar" becomes a task in this change.
- [ ] 7.3 Cristo revisó el Horario en cuadrícula con el estado de sincronización: coincide / cambiar / quitar. Verify: his answer recorded here; "cambiar" becomes a task in this change.
- [ ] 7.4 Cristo revisó ocultar el tiempo y el avance por sesión: coincide / cambiar / quitar. Verify: his answer recorded here; "cambiar" becomes a task in this change.
- [ ] 7.5 Cristo revisó la barra hacia la siguiente sección: coincide / cambiar / quitar. Verify: his answer recorded here; "cambiar" becomes a task in this change.
- [ ] 7.6 Cristo revisó "Pensando… N s" con detalles y la estimación de tiempo: coincide / cambiar / quitar. Verify: his answer recorded here; "cambiar" becomes a task in this change.
- [ ] 7.7 Cristo revisó el modo pantalla completa: coincide / cambiar / quitar. Verify: his answer recorded here; "cambiar" becomes a task in this change.
