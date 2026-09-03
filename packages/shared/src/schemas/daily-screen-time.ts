import { z } from 'zod';

// Task 8.3: mirrors server/prisma/schema.prisma's DailyScreenTime -- see its doc comment for why
// this reverses task 11.18's original "screen time never syncs" decision, and why `topApps` is a
// small JSON snapshot rather than its own table.
export const TopAppUsageSchema = z.object({
  packageName: z.string().min(1),
  minutes: z.number().int().min(0),
});

export const DailyScreenTimeSchema = z.object({
  id: z.string().optional(),
  date: z.string().datetime(),
  totalMinutes: z.number().int().min(0),
  topApps: z.array(TopAppUsageSchema).max(10),
});

export const UpsertDailyScreenTimeSchema = DailyScreenTimeSchema.omit({ id: true });

export type TopAppUsage = z.infer<typeof TopAppUsageSchema>;
export type DailyScreenTime = z.infer<typeof DailyScreenTimeSchema>;
export type UpsertDailyScreenTimeInput = z.infer<typeof UpsertDailyScreenTimeSchema>;
