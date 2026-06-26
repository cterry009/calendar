import { z } from 'zod';
import { ScheduleKindSchema } from './enums.js';

export const ScheduleSchema = z.object({
  id: z.string().optional(),
  kind: ScheduleKindSchema,
  dayOfWeek: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(0).max(1439),
  label: z.string().max(120).optional().nullable(),
  enabled: z.boolean().default(true),
});

export const CreateScheduleSchema = ScheduleSchema.omit({ id: true });
export const UpdateScheduleSchema = CreateScheduleSchema.partial();

export type Schedule = z.infer<typeof ScheduleSchema>;
export type CreateScheduleInput = z.infer<typeof CreateScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof UpdateScheduleSchema>;
