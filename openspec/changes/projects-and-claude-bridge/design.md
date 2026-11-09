# Design

## Context

Every client works from a full local snapshot and pushes changes through `POST /sync/batch`; after a
batch the server emits `sync:changes` so other devices re-pull (CLAUDE.md, Architecture). Access
tokens last 15 minutes, refresh tokens 30 days and are per device. The Claude desktop app already
runs one local stdio MCP server for the user (`biblioteca-fisica`), and a cloud Claude chat linked
to the computer sees its tools through the desktop bridge — that is the channel this change uses.
The study tutor goes the other way (the server runs `claude -p`) and is not touched.

## Goals / Non-Goals

**Goals:**
- One source of truth: the calendar's database, through its API.
- A Claude change is indistinguishable from an app change for sync, rules and notifications.
- Claude answers "¿cómo voy?" in one or two tool calls.

**Non-Goals:**
- The visual redesign (next change, web/desktop first).
- A remote/cloud MCP (the API only lives on the LAN; revisit with task 12.10's always-on machine).
- Claude editing blocking, the night window, the commitment, schedules or the study plan.
- Google Calendar sync.

## Decisions

1. **Bridge talks to the API, not Prisma.** Writing to Postgres directly would skip
   `forbidNonWhitelisted` validation, the commitment check, conflict handling and `sync:changes`.
   Alternative rejected: a Nest `mcp` module inside the server — it would make the API process
   speak stdio to the desktop app and die with every `nest start --watch` reload.
2. **Own device, `DevicePlatform.AGENT`.** `npm run login --prefix services/claude-mcp` asks for
   email and password once, calls `/auth/login` with platform `AGENT` and label "Claude", and stores
   the refresh token in `%APPDATA%\calendar-claude-mcp\token.json` (or `~/.config/...` on Linux).
   The bridge refreshes access tokens itself and rotates the stored refresh token. Alternative
   rejected: reusing the web device's token — revoking Claude would sign the web app out.
3. **Reads from `/sync/pull`, summarized with `@calendar/shared`.** The bridge pulls the snapshot
   (cached a few seconds within a conversation) and computes today/week/attention with the same
   shared functions the apps use (built package, like the server). Tools return compact JSON plus a
   short Spanish summary line. Reports come from their existing endpoints. Alternative rejected:
   new read endpoints per tool — more server surface for the same data.
4. **Writes as one-change batches.** Each write tool builds one change with a fresh client id and
   `updatedAt = now`, sends `/sync/batch` and reports `applied` or the conflict/refusal reason. No
   retries on refusal. Plan approval uses the existing `/planning/suggestions/:id/approve|dismiss`.
5. **Project storage.** `Project` (status/priority enums, `nextSteps String[]`, `progress Int?`,
   `deadline DateTime?` stored as a day like `HabitRecord.date`) and `ProjectLogEntry` (`date`,
   `text`, `source ProjectLogSource`), both with `clientId`/`deletedAt` like `Task`.
   `Task.projectId` is nullable with `onDelete: SetNull`. Log entries are editable (updatedAt-wins),
   not immutable creates: the user corrects typos. Alternative rejected: storing the log inside the
   project row — every new entry would conflict with a concurrent project edit.
6. **Attention rule in `packages/shared/src/projects/attention.ts`**, pure and tested, taking the
   projects, the log and "today" in the user's time zone. Thresholds (10 and 14 days) are constants
   there.
7. **Tools (Spanish names, as the UI):** `hoy`, `semana`, `proyectos`, `proyecto`, `tareas`,
   `habitos`, `reportes`; `crear_tarea`, `actualizar_tarea`, `completar_tarea`, `crear_proyecto`,
   `actualizar_proyecto`, `registrar_avance`, `registrar_habito`, `responder_sugerencia`;
   `borrar_tarea`, `borrar_proyecto` marked `destructiveHint`. Each description says what it changes
   and that it notifies the other devices.

## Risks / Trade-offs

- [The computer is off or the API is down, so the chat can't reach the calendar] → clear message
  with start commands; the remote option waits for 12.10.
- [A stolen token file gives full sync access] → it lives in the user profile, not the repo; the
  device can be revoked from the app; the bridge never logs tokens.
- [Claude makes a change the user didn't mean] → one record per call, no bulk tools, nothing on
  blocking or the commitment; every change shows up in the apps and can be undone there.
- [`/sync/pull` grows] → it is already bounded (30 days of block events, 60 of completions); the
  bridge caches it briefly.

## Migration Plan

Additive migration only (new tables, nullable column, enum value). Old clients ignore the new
snapshot fields; new clients default them to `[]`. Rollback: stop registering the MCP server; the
tables can stay.
