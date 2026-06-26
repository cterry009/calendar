import { z } from 'zod';
import { BlockListKindSchema, DevicePlatformSchema } from './enums.js';

export const BlockListEntrySchema = z.object({
  id: z.string().optional(),
  kind: BlockListKindSchema,
  identifier: z.string().min(1).max(255),
  label: z.string().min(1).max(120),
  platform: DevicePlatformSchema.optional().nullable(),
  highDopamine: z.boolean().default(false),
  enabled: z.boolean().default(true),
});

export const CreateBlockListEntrySchema = BlockListEntrySchema.omit({ id: true });
export const UpdateBlockListEntrySchema = CreateBlockListEntrySchema.partial();

export type BlockListEntry = z.infer<typeof BlockListEntrySchema>;
export type CreateBlockListEntryInput = z.infer<typeof CreateBlockListEntrySchema>;
export type UpdateBlockListEntryInput = z.infer<typeof UpdateBlockListEntrySchema>;
