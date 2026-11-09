# Design

## Decisions

1. **Same database, own module, not synced offline.** These are reference data the user reads on the
   PC and edits rarely; a REST module (`/research/...`) keeps the offline sync unchanged. The phone
   only sees deadline tasks (normal synced tasks). Alternative rejected: a second database —
   another service to back up and start every morning for a few hundred rows.
2. **Upsert keys:** `ResearchProgram (userId, url)`, `Researcher (userId, pageUrl)`,
   `ResearchPaper (userId, arxivId)` or `(userId, url)` when there is no arXiv id. Every row keeps
   `lastVerifiedAt` and `source` ("radar", "manual").
3. **User fields are never overwritten by a radar:** `myOpinion`, `status` set by the user, and
   reading status/level are written only from the app (or Claude when the user asks in chat).
4. **Deadline tasks:** `clientId = "radar:<programId>:<date>"`, so a changed date replaces its own task.
5. **Local runs:** a Windows task at 08:05 (after the 07:50 wake) runs `claude -p` with each radar's
   prompt, the bridge MCP and web search; the run logs to `%LOCALAPPDATA%\CalendarProductivity`. The
   cloud tasks are disabled once two local runs succeed.

## Open Questions

- Whether the reading log's comprehension questions ("Bitácora de lectura PINN") move into the app
  as well, or stay in their artifact (doesn't change the tables: reading level is a field).
