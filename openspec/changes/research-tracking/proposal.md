# Proposal

## Why

Since 2026-11-08 two daily scheduled Claude runs keep a radar of master's programs (few letters,
stochastic-process courses in maths and physics) and of researchers and papers close to the user's
work, and another chat keeps a reading log of PINN papers. They live as separate Claude documents
and pages (one run even created a second "Radar de maestrías" page instead of updating the doc). The
user likes them and wants them inside the calendar (2026-11-09): stored with the rest of his data,
deadlines on his calendar, and visible in the app.

## What Changes

1. **Research data in the calendar's database** (same Postgres, new tables; no second database):
   `ResearchProgram` (master's / direct PhD programs with letters, stochastic courses, groups, cost,
   language, next deadline, score, status and the user's own opinion), `Researcher` (affiliation,
   topics, whether they take students, page) and `ResearchPaper` (title, authors, link, arXiv id,
   date, topic, why it matters, reading status and level).
2. **Idempotent upserts** keyed on the program's official URL, the researcher's page and the paper's
   arXiv id or URL, so a daily run updates rows instead of duplicating them; nothing is deleted, a
   program is moved to closed/discarded with a reason.
3. **Deadlines on the calendar:** a program deadline within 90 days becomes a task in the carrera
   category (one per program and deadline), updated if the date changes.
4. **Writing from Claude:** tools in the Claude bridge (`projects-and-claude-bridge`) to upsert
   programs, researchers and papers and to read them back.
5. **Where the radars run:** the two radars move from the cloud to the user's PC after the morning
   wake (Windows task, `claude -p` with the bridge), because cloud runs can't reach the API on the
   LAN. The Claude documents stay as a read-only export until the app view exists, then are retired.
6. **A "Investigación" section** in web/desktop (Maestrías, Investigadores, Lecturas) with filters and
   the user's opinion/status editable — built with the agenda-redesign look.

## Capabilities

### New Capabilities
- `research-tracking`: programs, researchers and papers stored in the calendar, their upsert rules,
  the deadline tasks, the Claude tools and the app section.

### Modified Capabilities
<!-- none -->

## Impact

- `server/prisma/schema.prisma` + migration, a `research` Nest module (REST read/write, userId-scoped),
  tests; `services/claude-mcp/` research tools (after the bridge exists); `scripts/` local radar runner
  registered after the morning task; `apps/web` Investigación section. Depends on
  `projects-and-claude-bridge` (bridge) and `agenda-redesign` (look).
