import { z } from 'zod';
import { FitnessIntensitySchema, FitnessSourceSchema } from './enums.js';

export const FitnessEntrySchema = z.object({
  id: z.string().optional(),
  activityType: z.string().min(1).max(120),
  durationMinutes: z.number().int().min(1),
  intensity: FitnessIntensitySchema.default('MEDIUM'),
  notes: z.string().max(2000).optional().nullable(),
  loggedAt: z.string().datetime(),
  source: FitnessSourceSchema.default('MANUAL'),
  externalId: z.string().max(255).optional().nullable(),
});

export const CreateFitnessEntrySchema = FitnessEntrySchema.omit({ id: true });
export const UpdateFitnessEntrySchema = CreateFitnessEntrySchema.partial();

export type FitnessEntry = z.infer<typeof FitnessEntrySchema>;
export type CreateFitnessEntryInput = z.infer<typeof CreateFitnessEntrySchema>;
export type UpdateFitnessEntryInput = z.infer<typeof UpdateFitnessEntrySchema>;
