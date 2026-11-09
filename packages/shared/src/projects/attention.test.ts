import { ProjectSchema } from '../schemas/project.js';
import { projectsNeedingAttention } from './attention.js';

const TODAY = '2026-11-09';

describe('projectsNeedingAttention', () => {
  it('flags blocked, near deadlines and stale active projects; never done or idea', () => {
    const projects = [
      { id: 'b', status: 'BLOCKED' as const, blocker: 'esperando cartas' },
      { id: 'd', status: 'ACTIVE' as const, deadline: '2026-11-23' },
      { id: 'far', status: 'ACTIVE' as const, deadline: '2026-11-24' },
      { id: 's', status: 'ACTIVE' as const },
      { id: 'fresh', status: 'ACTIVE' as const },
      { id: 'idea', status: 'IDEA' as const },
      { id: 'done', status: 'DONE' as const, deadline: '2026-11-10' },
      { id: 'paused', status: 'PAUSED' as const },
    ];
    const log = [
      { projectId: 's', date: '2026-10-28' },
      { projectId: 'fresh', date: '2026-11-05' },
      { projectId: 'far', date: '2026-11-08' },
    ];
    expect(projectsNeedingAttention(projects, log, TODAY)).toEqual([
      { projectId: 'b', kind: 'blocked', reason: 'Bloqueado: esperando cartas' },
      { projectId: 'd', kind: 'deadline', reason: 'Fecha límite en 14 días' },
      { projectId: 's', kind: 'stale', reason: 'Sin avances hace 12 días' },
    ]);
  });

  it('an active project with no log at all is flagged; exactly 9 days is not', () => {
    expect(projectsNeedingAttention([{ id: 'x', status: 'ACTIVE' }], [], TODAY)[0].reason).toBe('Sin avances registrados');
    expect(projectsNeedingAttention([{ id: 'x', status: 'ACTIVE' }], [{ projectId: 'x', date: '2026-10-31' }], TODAY)).toEqual([]);
  });

  it('deleted entries and projects are ignored', () => {
    expect(
      projectsNeedingAttention(
        [{ id: 'x', status: 'ACTIVE' }, { id: 'y', status: 'BLOCKED', deletedAt: '2026-11-01T00:00:00Z' }],
        [{ projectId: 'x', date: '2026-11-08', deletedAt: '2026-11-08T10:00:00Z' }],
        TODAY,
      ).map((a) => a.projectId),
    ).toEqual(['x']);
  });
});

describe('ProjectSchema', () => {
  it('accepts no progress and rejects progress outside 0-100', () => {
    expect(ProjectSchema.parse({ title: 'PINNs' }).progress).toBeUndefined();
    expect(ProjectSchema.safeParse({ title: 'PINNs', progress: 101 }).success).toBe(false);
    expect(ProjectSchema.safeParse({ title: 'PINNs', progress: -1 }).success).toBe(false);
    expect(ProjectSchema.safeParse({ title: 'PINNs', progress: 55 }).success).toBe(true);
  });
});
