import { z } from 'zod';
import { FitnessSourceSchema } from './enums.js';

// One row per calendar day, same shape and reasoning as DailyStepCountSchema (task 10.6/10.8):
// a phone's barometer reports a running daily total of floors climbed, not discrete logged
// sessions, and the day's count only ever grows -- see apps/mobile/src/hooks/useDailyFloors.ts
// for how a floor gets counted (an altitude gain, derived from raw pressure, crossing a
// per-floor threshold) and daily-step-count.ts for why `date` is a full UTC-midnight timestamp
// rather than a plain `YYYY-MM-DD` string.
export const DailyFloorsClimbedSchema = z.object({
  id: z.string().optional(),
  date: z.string().datetime(),
  floors: z.number().int().min(0),
  source: FitnessSourceSchema.default('DEVICE_SENSOR'),
});

export const UpsertDailyFloorsClimbedSchema = DailyFloorsClimbedSchema.omit({ id: true });

export type DailyFloorsClimbed = z.infer<typeof DailyFloorsClimbedSchema>;
export type UpsertDailyFloorsClimbedInput = z.infer<typeof UpsertDailyFloorsClimbedSchema>;
