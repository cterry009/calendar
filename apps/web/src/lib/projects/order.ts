import type { SyncProject } from '../calendar/types';

// 2026-11-10: projects by priority (alta first); inside a priority the ones with the nearest deadline,
// then the ones that ask for attention, then by name.

export const PRIORITY_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
export const PRIORITY_LABEL = { HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' } as const;

export function byPriority(attention: ReadonlySet<string>) {
  return (a: SyncProject, b: SyncProject): number =>
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') ||
    Number(attention.has(b.id)) - Number(attention.has(a.id)) ||
    a.title.localeCompare(b.title, 'es');
}
