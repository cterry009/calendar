import { beforeEach, describe, expect, it, vi } from 'vitest';

const syncBatch = vi.fn();
const enqueueSyncItem = vi.fn();
vi.mock('../offline/sync-client', () => ({ syncBatch, enqueueSyncItem }));

const { exerciseAttemptsOf, logExerciseAttempt } = await import('./attempts');

const input = {
  exerciseId: 'AN1#3#2',
  exerciseSource: 'nota' as const,
  noteCode: 'AN1',
  section: '3',
  b: 0,
  r: 1 as const,
  hints: 0,
  minutes: null,
  gradedBy: 'usuario' as const,
  supersedes: 'ea-claude',
};

describe('exercise attempts on the web', () => {
  beforeEach(() => {
    syncBatch.mockReset();
    enqueueSyncItem.mockReset().mockResolvedValue(undefined);
  });

  it('reads a cached snapshot from before the study game as no attempts', () => {
    expect(exerciseAttemptsOf({})).toEqual([]);
  });

  it('sends a correction as a new attempt with its own id', async () => {
    syncBatch.mockResolvedValue({ applied: {}, conflicts: {} });
    const sent = logExerciseAttempt(input);
    expect(sent).toMatchObject({
      ...input,
      id: expect.any(String),
      occurredAt: expect.any(String),
    });
    expect(syncBatch).toHaveBeenCalledWith({ exerciseAttempts: [sent] });
    await Promise.resolve();
    expect(enqueueSyncItem).not.toHaveBeenCalled();
  });

  it('queues the attempt when the send fails while online', async () => {
    syncBatch.mockRejectedValue(new Error('server down'));
    const sent = logExerciseAttempt(input);
    await vi.waitFor(() =>
      expect(enqueueSyncItem).toHaveBeenCalledWith('exerciseAttempts', [sent]),
    );
  });
});
