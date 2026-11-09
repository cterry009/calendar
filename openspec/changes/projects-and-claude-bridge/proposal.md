# Proposal

## Why

The user wants one system for everything and to run it from a Claude chat (2026-11-08): ask "¿cómo
voy esta semana?", log progress on a project, add a task or approve the plan, and see the change on
the phone and the desktop right away. Today the calendar has tasks, blocks, pomodoros, habits and
reports, but no notion of the user's projects (PINNs, master's application, CVs, tutoring, the RAG,
the Total War mod, NexusOS…), and Claude can only reach it through the study tutor. A separate
project board was prototyped as a Claude artifact the same day; it duplicates tasks and habits, so
its one new idea — projects with progress and a log — moves here and the artifact is retired.

## What Changes

1. **Projects.** A synced `Project` entity: title, one-line summary, status (active, paused,
   blocked, idea, done), priority, area, color, optional deadline, optional progress 0–100 (null =
   not estimated), next steps (ordered list) and a blocker note. Tasks gain an optional `projectId`.
2. **Project log.** A synced `ProjectLogEntry`: project, day, text and where it came from (app or
   Claude). This is the "avances" history; the last entry's date drives "needs attention".
3. **Attention rule in shared.** One function decides which projects need attention (blocked;
   deadline within 14 days; active with no log entry for 10+ days), so the apps, the daily email
   and Claude all say the same thing.
4. **Claude bridge.** A local MCP server (`services/claude-mcp/`, stdio, registered in the Claude
   desktop app like `biblioteca-fisica`) exposing the calendar as tools: read today / the week /
   projects / tasks / habits / the latest reports, and write tasks, projects, log entries, habit
   check-ins, and approve or dismiss a pending plan suggestion. It talks only to the NestJS API, as
   its own revocable device, and every write goes through `/sync/batch`, so the server's rules and
   the live `sync:changes` notification apply exactly as for the apps.
5. **Minimal projects screen on web/desktop.** List and detail (log, linked tasks, edit). Styling
   is deliberately plain: the visual redesign is a separate change. Mobile shows a task's project
   name only.
6. **Daily email.** The 21:00 report lists the projects that need attention.
7. **Import.** The prototype board's 9 projects and 3 tasks are created through the bridge once it
   works, then the artifact and its paused morning summary are deleted.

## Capabilities

### New Capabilities
- `projects`: the user's projects, their log, their link to tasks, how they sync and when one needs
  attention.
- `claude-bridge`: what Claude can read and change in the calendar through the local MCP server,
  how it authenticates, and its safety limits.

### Modified Capabilities
<!-- none: openspec/specs/ is empty in this repo (no archived changes yet) -->

## Impact

- `server/prisma/schema.prisma` + migration: `Project`, `ProjectLogEntry`, `Task.projectId`,
  `DevicePlatform.AGENT`.
- Sync: `sync.types.ts`, `dto/sync-batch.dto.ts`, `sync.service.ts` (pull + two apply methods),
  `server/test/sync.service.test.ts`.
- `packages/shared`: Zod schemas `project.ts`, `project-log.ts`; `projects/attention.ts` + Jest tests.
- Clients' snapshot/offline types (web and mobile, `?? []` defaults); web projects route; mobile
  task row.
- `server/src/daily-report/`: attention section.
- New package `services/claude-mcp/` (Node ≥ 22, `@modelcontextprotocol/sdk`), its own lockfile,
  not in CI at first. A token file outside the repo (`%APPDATA%\calendar-claude-mcp\`).
- No change to the study tutor (`/tutor/turn` keeps running `claude -p` on the server).
