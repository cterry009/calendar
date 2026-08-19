import { z } from 'zod';
import { FocusTriggerKindSchema } from './enums.js';

export const FocusTriggerSchema = z
  .object({
    id: z.string().optional(),
    kind: FocusTriggerKindSchema,
    label: z.string().min(1).max(120),
    enabled: z.boolean().default(true),
    latitude: z.number().min(-90).max(90).optional().nullable(),
    longitude: z.number().min(-180).max(180).optional().nullable(),
    radiusMeters: z.number().int().min(10).max(50000).optional().nullable(),
    wifiSsid: z.string().min(1).max(64).optional().nullable(),
  })
  .refine(
    (value) =>
      value.kind !== 'LOCATION' ||
      (value.latitude != null && value.longitude != null && value.radiusMeters != null),
    { message: 'Location triggers require latitude, longitude, and radiusMeters', path: ['latitude'] },
  )
  .refine((value) => value.kind !== 'WIFI' || !!value.wifiSsid, {
    message: 'Wi-Fi triggers require wifiSsid',
    path: ['wifiSsid'],
  });

export const CreateFocusTriggerSchema = FocusTriggerSchema;
export const UpdateFocusTriggerSchema = FocusTriggerSchema;

export type FocusTrigger = z.infer<typeof FocusTriggerSchema>;
