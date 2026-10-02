// Tasks imported from the vault (scripts/import-study-notes.mjs) carry a stable clientId
// `note:<pensum file>#<note code or block number>#<unit>[.<part>]` -- the part when a unit of
// several sessions is split into one task per session. The pensum file is the study "line", and
// (note, unit, part) its order: AN1 #1.1 before AN1 #1.2 before AN1 #2 before AN2 #1.

const STUDY_KEY = /^note:(.+)#([^#]+)#(\d+)(?:\.(\d+))?$/;

export interface StudyKey {
  line: string;
  note: string;
  session: number;
  /** Session within a split unit; 0 for a unit that's one task. */
  part: number;
}

export function parseStudyKey(clientId: string | null): StudyKey | null {
  const m = clientId ? STUDY_KEY.exec(clientId) : null;
  return m ? { line: m[1], note: m[2], session: Number(m[3]), part: m[4] ? Number(m[4]) : 0 } : null;
}

const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

/** Numbers each task's position within its line (0, 1, 2, ...), keyed by clientId. */
export function studyLineOrder(clientIds: Array<string | null>): Map<string, { id: string; order: number }> {
  const byLine = new Map<string, Array<{ clientId: string; key: StudyKey }>>();
  for (const clientId of clientIds) {
    const key = parseStudyKey(clientId);
    if (!clientId || !key) continue;
    const list = byLine.get(key.line) ?? [];
    list.push({ clientId, key });
    byLine.set(key.line, list);
  }
  const out = new Map<string, { id: string; order: number }>();
  for (const [line, list] of byLine) {
    list.sort((a, b) => collator.compare(a.key.note, b.key.note) || a.key.session - b.key.session || a.key.part - b.key.part);
    list.forEach(({ clientId }, order) => out.set(clientId, { id: line, order }));
  }
  return out;
}
