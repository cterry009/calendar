import { z } from 'zod';
import { FitnessSourceSchema } from './enums.js';

// One row per calendar day, not an append-only log like FitnessEntry -- a device's step sensor
// reports a running daily total, not discrete logged sessions (task 10.6). `date` is the
// day-truncated UTC midnight this count belongs to (a plain date string, `YYYY-MM-DD`, is
// deliberately not used here since the client already needs a real Date to compute "today" in
// its own local timezone before sending -- see apps/mobile/src/lib/steps/dailySteps.ts).
export const DailyStepCountSchema = z.object({
  id: z.string().optional(),
  date: z.string().datetime(),
  steps: z.number().int().min(0),
  source: FitnessSourceSchema.default('DEVICE_SENSOR'),
});

export const UpsertDailyStepCountSchema = DailyStepCountSchema.omit({ id: true });

export type DailyStepCount = z.infer<typeof DailyStepCountSchema>;
export type UpsertDailyStepCountInput = z.infer<typeof UpsertDailyStepCountSchema>;
