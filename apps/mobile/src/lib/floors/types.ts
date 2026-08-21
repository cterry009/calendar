import type { FitnessSource } from '@calendar/shared';

export interface SyncFloorsClimbedRecord {
  id: string;
  date: string;
  floors: number;
  source: FitnessSource;
}
