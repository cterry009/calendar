## Why

The user wants the weekend to feel like a weekend and the weeknights to start winding down earlier
for the worst offenders (2026-11-02/04): a later night block on Friday and Saturday, earlier ones for
League of Legends and Discord, reminders for weekend activities (not study), a Sunday report to look
at how the week went, and the apps impossible to close or switch off for at least a week.

## What Changes

1. **Night block by day and by app.**
   - The synced night window (`StudyPlanData.nightWindow`) gains `weekendStartMinutes` (default
     00:00): on Friday and Saturday nights the general block (social media, games, the NIGHT list)
     starts then instead of at 22:00. The end (08:00) and the morning unlock are the same every day.
   - NIGHT block-list entries gain `nightStartMinutes` / `weekendNightStartMinutes`: that app or site
     starts at its own time. Set for the user: League of Legends 20:00 / 22:00, Discord 22:00 / 22:00.
   - The pre-night warnings follow each app's own start.
2. **Weekend activities.** A `Habit` with `kind = WEEKEND_ACTIVITY`: a title, Saturday or Sunday,
   a time. It notifies at that time on the phone and is ticked like a habit, but stays out of the
   habit list and score. At most 3 per day.
3. **Weekly report.** Sunday at 18:00 (`WEEKLY_REPORT_TIME`) the configured user gets the week
   (Monday to Sunday) compared with the one before: focus, schedule, tasks, study, screen and game
   time, blocks, mornings, steps, habits and weekend activities. Attached: a CSV with one row per day,
   the same as JSON, and a self-contained HTML presentation of the most relevant data. The web/desktop
   app keeps past weeks under *Reportes → Semana*.
4. **Block commitment.** "No se puede cerrar": a `BlockCommitment` that ends on a date (7 days to
   start) or never. Only extendable. While it lasts:
   - The server refuses sync changes that weaken the night block (deleting, disabling or delaying
     NIGHT entries, a later night window).
   - Android: the app is a device admin (no uninstall without deactivating it), and the
     accessibility service sends the user home from this app's Settings pages (force stop,
     uninstall, the accessibility toggle, device admin) and from the uninstall dialog. Night blocking
     and total lockdown can't be switched off.
   - Windows: "Salir" greyed out in the tray, start with Windows forced on, and a scheduled task
     relaunches the app if it's killed (release builds).

## Decisions

- Per-app start times live on the block-list entry (already synced, already per platform) rather
  than a new table. A start of 00:00 means "from midnight": no evening portion that night.
- Weekend activities reuse `Habit` (sync, reminders and check-ins already work end to end) with a
  `kind`, instead of a new synced entity.
- `WeeklyReport` and `BlockCommitment` are server-only tables. The commitment reaches the clients in
  the sync snapshot (`commitment`), read-only; it's started and extended through `/commitment`.
- The presentation is generated on the server from the same JSON as the CSV, with inline SVG charts
  and no external scripts, so it opens offline from the email attachment and in the app (iframe).
  The email body itself is plain HTML (Gmail runs no scripts and shows no SVG).
- Limits stated plainly: safe mode, `adb` or a Windows administrator can still get around the
  commitment. It is for self-control, not an MDM.
