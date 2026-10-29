## Why

The user wants the day in their inbox (2026-10-29): every evening, what the day was and what the next
one holds, and when nothing is planned for it, a plan of blocks to approve in the app instead of
planning from scratch in the morning.

## What Changes

- The dev account moves to the user's own email (`c.terry009@gmail.com`, same id, data and password).
- The server sends a daily report at 21:00 (`DAILY_REPORT_TIME`) to `DAILY_REPORT_EMAIL` only, through
  Gmail with an app password. It covers the day (blocks and focus, "no puedo" blocks, tasks done and
  left over, habits, steps, screen and game time) and the next day (its WORK blocks, what's planned).
- When the next day has WORK blocks and nothing planned, the planner (`PlanningService.propose`)
  proposes one and it's stored as a `PlanSuggestion`; the email lists it.
- The PC (calendar page) and the phone (home) show "Plan sugerido para mañana" with Aprobar /
  Descartar. Approving writes the tasks' `scheduledAt` and priority on the server, like the phone's
  Plan screen does, and every device re-pulls.
- The server runs on the user's PC: a report missed while it was off goes out at the next start
  (yesterday's only, never older).

## Decisions

- Gmail SMTP (nodemailer) over an email API: no new account, sent from the user's own address.
- `DailyReport` and `PlanSuggestion` are server-only tables, not synced entities: the suggestion is
  answered online through `/planning/suggestions`, and what it changes (tasks) already syncs.
- A pending suggestion is rebuilt when the email goes out (tasks may have changed since a preview);
  an approved or dismissed one is never replaced.
