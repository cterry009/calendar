// 2026-11-09: a project's progress -- the stored estimate when there is one, otherwise the share of
// its specific objectives that are done; null when neither exists ("Avance sin estimar").

export interface ProgressInput {
  progress: number | null;
  specificObjectives?: ReadonlyArray<{ done: boolean }> | null;
}

export function projectProgress(p: ProgressInput): { value: number; source: 'estimate' | 'objectives' } | null {
  if (p.progress !== null && p.progress !== undefined) return { value: p.progress, source: 'estimate' };
  const objs = p.specificObjectives ?? [];
  if (objs.length === 0) return null;
  return { value: Math.round((100 * objs.filter((o) => o.done).length) / objs.length), source: 'objectives' };
}
