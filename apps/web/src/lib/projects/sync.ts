import type { SyncProject } from '../calendar/types';
import { syncBatch } from '../offline/sync-client';

// A project edit from the app. The server fills omitted fields with defaults (summary, nextSteps...),
// so the whole project goes with the change.
export async function saveProject(p: SyncProject, patch: Partial<SyncProject>): Promise<void> {
  const next = { ...p, ...patch };
  await syncBatch({
    projects: [
      {
        id: next.id,
        updatedAt: new Date().toISOString(),
        title: next.title,
        summary: next.summary,
        status: next.status,
        priority: next.priority,
        area: next.area,
        color: next.color,
        deadline: next.deadline ? next.deadline.slice(0, 10) : null,
        progress: next.progress,
        nextSteps: next.nextSteps,
        blocker: next.blocker,
        generalObjective: next.generalObjective ?? null,
        specificObjectives: next.specificObjectives ?? [],
        tags: next.tags ?? [],
      },
    ],
  });
}
