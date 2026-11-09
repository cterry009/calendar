# Tasks

## 1. Data model and shared logic

- [x] 1.1 Add `Project`, `ProjectLogEntry`, their enums, `Task.projectId` (SetNull) and `DevicePlatform.AGENT` to `server/prisma/schema.prisma`; create the migration with `npm run prisma:migrate --prefix server` (server stopped). Verify: migration applies on a fresh `calendar_test`.
- [x] 1.2 Zod schemas `packages/shared/src/schemas/project.ts` and `project-log.ts` (progress 0–100 or null, next steps array), exported from `index.ts`; `projectId` optional on the task schema. Verify: `schemas.test.ts` cases for valid/invalid progress.
- [x] 1.3 `packages/shared/src/projects/attention.ts` (blocked / deadline ≤ 14 days / active without a log entry for ≥ 10 days; never done or idea) with reasons in Spanish. Verify: Jest tests for each rule and the boundaries; `npm run build:shared`.

## 2. Sync

- [x] 2.1 Add `project` and `projectLogEntry` to `sync.types.ts`, `dto/sync-batch.dto.ts` (class-validator on every field) and the pull in `sync.service.ts`. Verify: `GET /sync/pull` returns both lists.
- [x] 2.2 `applyProjectChange` / `applyProjectLogEntryChange` (updatedAt-wins, soft delete, userId-scoped; deleting a project unlinks its tasks). Verify: new cases in `server/test/sync.service.test.ts` (create, conflict, delete keeps tasks).
- [x] 2.3 Accept `projectId` on task changes, refusing a project of another user. Verify: test.

## 3. Clients

- [ ] 3.1 Web: snapshot/offline types and conflict handling for both entities (`?? []` defaults). Verify: `npm run typecheck --prefix apps/web`, existing Vitest pass.
- [ ] 3.2 Web/desktop: plain `/proyectos` route — list with status, priority, progress or "sin estimar", attention flags; detail with next steps, log (add entry), linked tasks; create/edit/delete; project picker on the task form. Verify: Vitest for the list's sort and attention badges; tried in `npm run dev --prefix apps/web`.
- [ ] 3.3 Mobile: snapshot/offline types (`db.ts`, `lib/sync/api.ts`) and the project name on task rows. Verify: `npm run typecheck --prefix apps/mobile`; tried on the phone (relaunch with `monkey`, check accessibility).

## 4. Daily email

- [ ] 4.1 "Proyectos que piden atención" section in the 21:00 report using `attention.ts`, omitted when empty. Verify: server test on the report builder with and without flagged projects.

## 5. Claude bridge (`services/claude-mcp/`)

- [ ] 5.1 Scaffold the package (Node ≥ 22, TypeScript, `@modelcontextprotocol/sdk`, stdio), its README (Spanish) and `.gitignore`; API base URL from `CALENDAR_API_URL` (default `http://localhost:3000`). Verify: `npm run build --prefix services/claude-mcp`.
- [ ] 5.2 `login` script (platform `AGENT`, label "Claude") storing the refresh token in the user's config dir; client that refreshes and rotates tokens; clear errors for API down and revoked device. Verify: logs in, survives an access-token expiry, fails cleanly after revoking the device in the app.
- [ ] 5.3 Read tools `hoy`, `semana`, `proyectos`, `proyecto`, `tareas`, `habitos`, `reportes` over a briefly cached `/sync/pull`, computed with `@calendar/shared`, in the user's time zone. Verify: unit tests against a fixture snapshot.
- [ ] 5.4 Write tools (one change per `/sync/batch`, reporting applied/conflict/refusal) and `responder_sugerencia`; delete tools marked destructive. Verify: integration test against the dev API with the dev user only; a task created from the tool appears on the web app live.
- [ ] 5.5 Register it in the Claude desktop app config next to `biblioteca-fisica` (documented in the README) and check that the linked cloud chat lists the tools. Verify: from the chat, "¿qué tengo hoy?" answers from real data.

## 6. Move the prototype board

- [ ] 6.1 From the chat, create through the bridge the 9 projects and 3 master's tasks of the Claude artifact "Agenda de Cristo" (habits stay the calendar's own). Verify: they show on `/proyectos` and on the phone.
- [ ] 6.2 Delete the artifact and its paused morning summary once the user confirms. Verify: the user confirms nothing is missing.

## 7. Revisión (feature-review-gate)

Each feature reaches Cristo as a review card (what it does, how to try it in ≤ 2 min, the assumptions taken) and is checked off only with his answer.

- [ ] 7.1 Cristo revisó la pantalla de Proyectos (lista, detalle, bitácora, tareas enlazadas): coincide / cambiar / quitar. Verify: his answer recorded here; "cambiar" becomes a task in this change.
- [ ] 7.2 Cristo revisó los proyectos que piden atención en el correo de las 21:00: coincide / cambiar / quitar. Verify: his answer recorded here; "cambiar" becomes a task in this change.
- [ ] 7.3 Cristo revisó hablar con el calendario desde el chat de Claude (las herramientas del puente): coincide / cambiar / quitar. Verify: his answer recorded here; "cambiar" becomes a task in this change.

## Workflow follow-up

- Next change: visual redesign of web/desktop with the prototype board's look (tokens in `packages/ui`), then mobile.
