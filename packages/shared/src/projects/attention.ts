// projects-and-claude-bridge: which projects need attention, one rule for the apps, the daily email
// and Claude. Blocked; a deadline within DEADLINE_SOON_DAYS; or active with no log entry for
// STALE_DAYS (or none at all). Done and idea projects are never flagged.

export const STALE_DAYS = 10;
export const DEADLINE_SOON_DAYS = 14;

export interface AttentionProject {
  id: string;
  status: 'ACTIVE' | 'PAUSED' | 'BLOCKED' | 'IDEA' | 'DONE';
  deadline?: string | null;
  blocker?: string | null;
  deletedAt?: string | null;
}

export interface AttentionLogEntry {
  projectId: string;
  date: string;
  deletedAt?: string | null;
}

export interface ProjectAttention {
  projectId: string;
  kind: 'blocked' | 'deadline' | 'stale';
  reason: string;
}

const keyMs = (key: string) => {
  const [y, m, d] = key.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const daysBetween = (from: string, to: string) => Math.round((keyMs(to) - keyMs(from)) / 86_400_000);

/** `today` is the user's local day as YYYY-MM-DD. One entry per flagged project, by severity. */
export function projectsNeedingAttention(
  projects: AttentionProject[],
  log: AttentionLogEntry[],
  today: string,
): ProjectAttention[] {
  const last = new Map<string, string>();
  for (const entry of log) {
    if (entry.deletedAt) continue;
    const prev = last.get(entry.projectId);
    if (!prev || entry.date > prev) last.set(entry.projectId, entry.date);
  }
  const out: ProjectAttention[] = [];
  for (const p of projects) {
    if (p.deletedAt || p.status === 'DONE' || p.status === 'IDEA') continue;
    if (p.status === 'BLOCKED') {
      out.push({ projectId: p.id, kind: 'blocked', reason: p.blocker ? `Bloqueado: ${p.blocker}` : 'Bloqueado' });
      continue;
    }
    if (p.deadline) {
      const left = daysBetween(today, p.deadline);
      if (left >= 0 && left <= DEADLINE_SOON_DAYS) {
        out.push({
          projectId: p.id,
          kind: 'deadline',
          reason: left === 0 ? 'La fecha límite es hoy' : `Fecha límite en ${left} ${left === 1 ? 'día' : 'días'}`,
        });
        continue;
      }
    }
    if (p.status === 'ACTIVE') {
      const lastDate = last.get(p.id);
      if (!lastDate) out.push({ projectId: p.id, kind: 'stale', reason: 'Sin avances registrados' });
      else {
        const since = daysBetween(lastDate, today);
        if (since >= STALE_DAYS) out.push({ projectId: p.id, kind: 'stale', reason: `Sin avances hace ${since} días` });
      }
    }
  }
  const order = { blocked: 0, deadline: 1, stale: 2 } as const;
  return out.sort((a, b) => order[a.kind] - order[b.kind]);
}
