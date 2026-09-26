import { z } from 'zod';

// Mirrors server/prisma/schema.prisma's DailyDesktopAppTime -- see its doc comment for why the
// Windows desktop gets its own table instead of writing into DailyScreenTime (that one is keyed
// [userId, date] and already written by Android), and why these minutes must never be summed with
// DailyGameTime's.
//
// `key` is the lowercased exe name (`chrome.exe`), which is also the identifier a `DESKTOP_APP`
// block-list entry matches on; `label` is the resolved display name ("Google Chrome"). No
// `source` field, unlike TopGameUsageSchema -- there is only one detector here (the foreground
// window), not three. See apps/desktop/src-tauri/src/app_tracking.rs.
export const TopDesktopAppUsageSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  minutes: z.number().int().min(0),
});

export const DailyDesktopAppTimeSchema = z.object({
  id: z.string().optional(),
  date: z.string().datetime(),
  totalMinutes: z.number().int().min(0),
  topApps: z.array(TopDesktopAppUsageSchema).max(10),
});

export const UpsertDailyDesktopAppTimeSchema = DailyDesktopAppTimeSchema.omit({ id: true });

export type TopDesktopAppUsage = z.infer<typeof TopDesktopAppUsageSchema>;
export type DailyDesktopAppTime = z.infer<typeof DailyDesktopAppTimeSchema>;
export type UpsertDailyDesktopAppTimeInput = z.infer<typeof UpsertDailyDesktopAppTimeSchema>;
