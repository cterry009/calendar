import { z } from 'zod';

// Windows desktop counterpart of daily-screen-time.ts -- mirrors server/prisma/schema.prisma's
// DailyGameTime. `source` identifies which detector attributed the minutes: Steam via the same
// registry "Running" flag Steam itself uses (key = appid), or Riot Client/Battle.net via a
// curated known-game-process table (key = the matched exe name). See
// apps/desktop/src-tauri/src/game_tracking.rs.
export const GameTimeSourceSchema = z.enum(['STEAM', 'RIOT', 'BATTLENET']);

export const TopGameUsageSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  minutes: z.number().int().min(0),
  source: GameTimeSourceSchema,
});

export const DailyGameTimeSchema = z.object({
  id: z.string().optional(),
  date: z.string().datetime(),
  totalMinutes: z.number().int().min(0),
  topGames: z.array(TopGameUsageSchema).max(10),
});

export const UpsertDailyGameTimeSchema = DailyGameTimeSchema.omit({ id: true });

export type GameTimeSource = z.infer<typeof GameTimeSourceSchema>;
export type TopGameUsage = z.infer<typeof TopGameUsageSchema>;
export type DailyGameTime = z.infer<typeof DailyGameTimeSchema>;
export type UpsertDailyGameTimeInput = z.infer<typeof UpsertDailyGameTimeSchema>;
