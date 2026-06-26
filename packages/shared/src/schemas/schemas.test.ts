import {
  CreateTaskSchema,
  TaskSchema,
} from '../schemas/task.js';
import { TaskDifficultySchema } from '../schemas/enums.js';
import { CreateScheduleSchema } from '../schemas/schedule.js';
import { PomodoroSessionSchema } from '../schemas/pomodoro.js';
import { CreateBlockListEntrySchema } from '../schemas/block-list.js';
import { CreateFitnessEntrySchema } from '../schemas/fitness.js';

describe('zod schemas', () => {
  it('validates a full task payload', () => {
    const parsed = TaskSchema.parse({
      title: 'Write report',
      estimatedMinutes: 90,
      difficulty: 'HARD',
      complexity: 8,
      priority: 'HIGH',
      status: 'PENDING',
    });

    expect(parsed.difficulty).toBe('HARD');
    expect(parsed.complexity).toBe(8);
  });

  it('rejects invalid task difficulty', () => {
    expect(() => TaskDifficultySchema.parse('EXTREME')).toThrow();
  });

  it('validates schedule windows', () => {
    const parsed = CreateScheduleSchema.parse({
      kind: 'WORK',
      dayOfWeek: 1,
      startMinute: 540,
      endMinute: 1020,
    });

    expect(parsed.kind).toBe('WORK');
  });

  it('validates pomodoro session defaults', () => {
    const parsed = PomodoroSessionSchema.parse({});
    expect(parsed.state).toBe('IDLE');
    expect(parsed.focusDurationMin).toBe(25);
  });

  it('validates block list entry', () => {
    const parsed = CreateBlockListEntrySchema.parse({
      kind: 'WEBSITE',
      identifier: 'twitter.com',
      label: 'Twitter',
      highDopamine: true,
    });

    expect(parsed.highDopamine).toBe(true);
  });

  it('validates fitness entry', () => {
    const parsed = CreateFitnessEntrySchema.parse({
      activityType: 'running',
      durationMinutes: 45,
      loggedAt: new Date().toISOString(),
    });

    expect(parsed.intensity).toBe('MEDIUM');
  });

  it('requires task title on create', () => {
    expect(() => CreateTaskSchema.parse({ estimatedMinutes: 30 })).toThrow();
  });
});
