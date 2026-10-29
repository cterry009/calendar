## 1. Account

- [x] 1.1 `dev@local.test` renamed to `c.terry009@gmail.com` in the dev database; `server/.env`
  (`STUDY_STATUS_EMAIL`) and `server/.env.dev-user` follow. The scripts take `CALENDAR_EMAIL`.

## 2. Server

- [x] 2.1 `DailyReport` and `PlanSuggestion` (migration `daily_email_report`).
- [x] 2.2 `server/src/daily-report/`: the report's wording (`report.ts`, pure), Gmail mailer, the
  21:00 check every 5 min with the one-day catch-up, the suggestion from the planner.
- [x] 2.3 `GET /planning/suggestions/pending`, `POST .../:id/approve|dismiss`,
  `POST /daily-report/send` (`?dryRun=true` previews, `?date=` another day).
- [x] 2.4 Integration tests (`test/daily-report.test.ts`): 21:00 once, catch-up, approve, already
  planned, dismiss, only the configured account, rebuild on send.

## 3. Apps

- [x] 3.1 PC: `PlanSuggestionCard` on the calendar page.
- [x] 3.2 Phone: `PlanSuggestionCard` on the home screen.

## 4. Real try

- [x] 4.1 Logged in as `c.terry009@gmail.com`; the dry run of 2026-10-29 listed Friday's four blocks
  and suggested "AN1 · Axiomas…" in Código de las notas (Gemini 503s, the fallback answered).
- [ ] 4.2 The user creates the Gmail app password; first real email.
- [ ] 4.3 Approve a suggestion from the PC and the phone.
