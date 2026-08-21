import type { FitnessSource } from '@calendar/shared';

export interface SyncStepCountRecord {
  id: string;
  date: string;
  steps: number;
  source: FitnessSource;
}
