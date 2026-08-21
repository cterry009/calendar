import type { TaskDifficulty, TaskPriority, TaskStatus } from '@calendar/shared';
import type { SyncBlockListRecord } from '../blocklist/types';
import type { SyncFitnessRecord } from '../fitness/types';
import type { SyncPomodoroRecord } from '../pomodoro/types';
import type { SyncStepCountRecord } from '../steps/types';

// Mirrors apps/web/src/lib/tasks/types.ts's SyncTaskRecord -- the server's sync payload adds
// createdAt/updatedAt/deletedAt on top of the pure @calendar/shared Task schema.
export interface SyncTaskRecord {
  id: string;
  clientId: string | null;
  title: string;
  description: string | null;
  scheduledAt: string | null;
  estimatedMinutes: number;
  estimatedPomodoros: number | null;
  actualMinutes: number | null;
  difficulty: TaskDifficulty;
  complexity: number;
  priority: TaskPriority;
  category: string | null;
  status: TaskStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface SyncScheduleRecord {
  id: string;
  kind: 'WORK' | 'REST';
  daysOfWeek: number[]; // 0=Sunday..6=Saturday, matches JS Date.getDay()
  startMinute: number;
  endMinute: number;
  label: string | null;
  enabled: boolean;
  pomodoroMin: number | null;
  shortBreakMin: number | null;
  longBreakMin: number | null;
  pomodorosPerChunk: number | null;
  chunks: number | null;
}

export interface SyncSnapshot {
  tasks: SyncTaskRecord[];
  schedules: SyncScheduleRecord[];
  pomodoroSessions: SyncPomodoroRecord[];
  fitnessEntries: SyncFitnessRecord[];
  dailyStepCounts: SyncStepCountRecord[];
  blockListEntries: SyncBlockListRecord[];
  syncedAt: string;
}
