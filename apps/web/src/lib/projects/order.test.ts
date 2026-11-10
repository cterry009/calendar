import { describe, expect, it } from 'vitest';
import type { SyncProject } from '../calendar/types';
import { byPriority } from './order';

const p = (id: string, priority: SyncProject['priority'], deadline: string | null = null) =>
  ({ id, title: id, priority, deadline }) as SyncProject;

describe('byPriority', () => {
  it('puts high priority first, then the nearest deadline, then attention', () => {
    const list = [p('c', 'LOW'), p('b', 'HIGH'), p('a', 'HIGH', '2026-12-01'), p('d', 'MEDIUM'), p('e', 'MEDIUM')];
    expect(list.sort(byPriority(new Set(['e']))).map((x) => x.id)).toEqual(['a', 'b', 'e', 'd', 'c']);
  });
});
