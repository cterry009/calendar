import { describe, expect, it } from 'vitest';
import { eventDetails, eventIdOfBar } from './eventDetails';
import type { CalendarEvent, SyncTask } from './types';

const at = (h: number, m = 0) => new Date(2026, 10, 9, h, m);
const block: CalendarEvent = {
  id: 'sched-1-2026-11-09',
  type: 'work',
  title: 'Paper: revisar los casos que fallan',
  start: at(16),
  end: at(17, 30),
  meta: { category: 'paper', description: 'Reproducir los casos que fallan', flexibleBlocks: 1 },
};
const task = (id: string, scheduledAt: string | null, extra: Partial<SyncTask> = {}): SyncTask =>
  ({ id, clientId: null, title: id, description: null, scheduledAt, estimatedMinutes: 25, estimatedPomodoros: 1,
     actualMinutes: null, difficulty: 'MEDIUM', complexity: 5, priority: 'MEDIUM', category: null, status: 'PENDING',
     completedAt: null, createdAt: '', updatedAt: '', deletedAt: null, ...extra }) as SyncTask;

describe('eventIdOfBar', () => {
  it('maps segment and window bars back to their block', () => {
    expect(eventIdOfBar('abc-segment-3')).toBe('abc');
    expect(eventIdOfBar('abc-window')).toBe('abc');
    expect(eventIdOfBar('task-9')).toBe('task-9');
  });
});

describe('eventDetails', () => {
  it('a block: about from the phase, todo from the suggested pomodoros, objectives = tasks inside it', () => {
    const tasks = [
      task('in', at(16, 10).toISOString()),
      task('out', at(15).toISOString()),
      task('deleted', at(16, 20).toISOString(), { deletedAt: 'x' }),
    ];
    const d = eventDetails(block, tasks, { paper: ['Reproducir el caso que falla', 'Diagnosticar y registrar'] }, at(15));
    expect(d.about).toBe('Reproducir los casos que fallan');
    expect(d.categoryName).toBe('Paper 📝');
    expect(d.todo).toEqual(['Pomodoro 1: Reproducir el caso que falla', 'Pomodoro 2: Diagnosticar y registrar']);
    expect(d.objectives.map((t) => t.id)).toEqual(['in']);
    expect(d.howToStart.at(-1)).toBe('Primer foco: Reproducir el caso que falla.');
    expect(d.startableNow).toBe(true);
  });

  it('is not startable once it is over or on another day', () => {
    expect(eventDetails(block, [], null, at(18)).startableNow).toBe(false);
    expect(eventDetails(block, [], null, new Date(2026, 10, 10, 9)).startableNow).toBe(false);
  });
});
