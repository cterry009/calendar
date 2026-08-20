import type { FitnessIntensity, FitnessSource } from '@calendar/shared';

export interface SyncFitnessRecord {
  id: string;
  activityType: string;
  durationMinutes: number;
  intensity: FitnessIntensity;
  notes: string | null;
  loggedAt: string;
  source: FitnessSource;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FitnessFormValues {
  activityType: string;
  durationMinutes: number;
  intensity: FitnessIntensity;
  notes: string | null;
}

export const FITNESS_INTENSITIES: FitnessIntensity[] = ['LOW', 'MEDIUM', 'HIGH'];

export const FITNESS_INTENSITY_LABELS: Record<FitnessIntensity, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
};
