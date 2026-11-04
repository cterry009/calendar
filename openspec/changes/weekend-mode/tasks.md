## 1. Night block by day and by app

- [x] 1.1 Shared: `blocking/nightSchedule.ts` (start for a day and an entry, window check, warnings,
  validation) + `nightWindow.weekendStartMinutes`; tests.
- [x] 1.2 `BlockListEntry.nightStartMinutes` / `weekendNightStartMinutes` (migration, sync DTO, apply,
  shared schema, client types); server test.
- [x] 1.3 Android: per-app starts pushed to native, `NightBlockRules` by weekday, per-app warnings,
  the night alarm on each day's start.
- [x] 1.4 Desktop: per-entry night activity in `DesktopBlockingBridge`, warnings per app, `a|b`
  process identifiers (split in the bridge, Rust gets plain names).
- [x] 1.5 Settings: weekend start next to the window, "Empieza a las…" per NIGHT entry (web + phone).
- [x] 1.6 The user's entries: LoL 20:00 / 22:00, Discord 22:00 / 22:00.

## 2. Weekend activities

- [x] 2.1 `Habit.kind` (`HABIT` | `WEEKEND_ACTIVITY`), migration, sync, shared schema, 3-per-day cap
  (shared + server).
- [x] 2.2 Out of the habit lists, score and daily report's habit count.
- [x] 2.3 "Fin de semana" section on the web and the phone; reminder text on the phone.

## 3. Weekly report

- [x] 3.1 `WeeklyReport` table; `server/src/weekly-report/`: gather the week, CSV/JSON, email,
  Sunday 18:00 with a one-week catch-up, `POST /weekly-report/send`, `GET /weekly-reports...`.
- [x] 3.2 Integration tests.

## 4. Block commitment

- [x] 4.1 `BlockCommitment`, `GET/POST /commitment` (extend only), in the sync snapshot; sync refuses
  weakening the night block while it lasts; tests.
- [x] 4.2 Android: device admin, Settings/uninstaller guard, night and lockdown forced on.
- [x] 4.3 Windows: no "Salir", autostart forced, relaunch task.
- [x] 4.4 The "Compromiso" card on the web and the phone; switches locked while it lasts.

## 5. Presentation

- [x] 5.1 The HTML presentation (pure, from the week's JSON), attached to the email.
- [x] 5.2 *Reportes → Semana* in the web/desktop app.

## 6. Real try

- [ ] 6.1 Phone: new build installed. Friday night at 00:00, LoL at 20:00 on a weekday, Discord at
  22:00, the weekend reminder's notification.
- [ ] 6.2 Phone: device admin granted; the Settings guard on this phone's real screens (App info,
  accessibility toggle, device admin, uninstall dialog) -- its words are matched blind so far, and
  the rest of Settings stays usable.
- [ ] 6.3 PC: release build installed. LoL killed at 20:00, "Salir" off, relaunched after a kill, the
  task gone when the commitment ends.
- [ ] 6.4 First Sunday report received, attachments opened on the PC and the phone.
