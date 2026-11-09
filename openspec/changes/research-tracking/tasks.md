# Tasks

## 1. Backend

- [ ] 1.1 Prisma models `ResearchProgram`, `Researcher`, `ResearchPaper` with the upsert keys and user-only fields; migration (server stopped). Verify: migration applies on `calendar_test`.
- [ ] 1.2 `research` Nest module: list/get/upsert per entity, userId-scoped, DTOs with class-validator; radar upserts never touch user fields. Verify: Vitest integration tests (upsert twice, opinion kept, other user's rows invisible).
- [ ] 1.3 Deadline tasks (`radar:<id>:<date>` clientId) created/moved/removed with the program. Verify: tests for create, move, discard.

## 2. Claude and radars

- [ ] 2.1 Bridge tools `investigacion_listar`, `programa_guardar`, `investigador_guardar`, `paper_guardar` (after `projects-and-claude-bridge` 5.x). Verify: a tool call creates and then updates one row.
- [ ] 2.2 Local radar runner: `scripts/run-radars.ps1` + Windows task at 08:05 running both radar prompts with `claude -p` and the bridge; log in `%LOCALAPPDATA%\CalendarProductivity\radars.log`. Verify: one manual run writes rows; the next morning's run updates them.
- [ ] 2.3 Import what the cloud radars already found (the two Claude documents and the "Radar de maestrías" page) once, through the tools. Verify: counts match the documents.
- [ ] 2.4 Disable the cloud radar tasks after two good local runs (with the user's OK). Verify: the user confirms.

## 3. App

- [ ] 3.1 Investigación section (Maestrías, Investigadores, Lecturas) with filters and editable user fields, in the agenda-redesign look. Verify: Vitest for filters; tried with real rows.
