// Study sessions in the WORK blocks (user-requested, 2026-10-07): which session a study block is on,
// whether it got done, and how far each line has come.
//
// A study session is a task imported from the vault's pensums (scripts/import-study-notes.mjs), with
// clientId `note:<pensum file>#<unit>#<n>`, created in pensum order. Each study block takes sessions
// from its lines in order, finishing one line before the next -- the same reference map the planner
// uses (docs/planning/mapa-lineas.json, mirrored here; a test keeps them equal). A session placed in
// the block by the weekly plan wins; otherwise the block is on the first pending session of its
// lines, so a session that isn't done simply stays first: it moves to the next block of that line.

export interface StudyLineMapEntry {
  /** Matched against the block's label. */
  titleContains: string;
  /** Pensum files, in the order the block works through them. */
  lines: string[];
}

export const STUDY_LINE_MAP: StudyLineMapEntry[] = [
  { titleContains: 'Estudio B1', lines: ['pensum_geometria_diff_hams.md', 'pensum_pilar_C.md', 'pensum_pilar_D.md'] },
  { titleContains: 'Estudio B2', lines: ['pensum_analisis.md', 'pensum_pilar_A.md', 'pensum_pilar_B.md'] },
];

/** Readable names for the pensums, for progress lists. */
export const STUDY_LINE_NAMES: Record<string, string> = {
  'pensum_geometria_diff_hams.md': 'Geometría y mecánica',
  'pensum_analisis.md': 'Análisis',
  'pensum_pilar_A.md': 'Pilar A',
  'pensum_pilar_B.md': 'Pilar B',
  'pensum_pilar_C.md': 'Pilar C',
  'pensum_pilar_D.md': 'Pilar D',
};

export interface StudyTaskLike {
  id: string;
  clientId: string | null;
  title: string;
  status: string;
  createdAt: string;
  deletedAt?: string | null;
  estimatedPomodoros?: number | null;
}

/** The pensum a study-session task comes from, or null for any other task. */
export function studyLineOf(task: Pick<StudyTaskLike, 'clientId'>): string | null {
  const match = /^note:([^#]+)#/.exec(task.clientId ?? '');
  return match ? match[1] : null;
}

/** The study lines a block works through, by its label; empty for a non-study block. */
export function studyLinesForBlock(label: string | null | undefined): string[] {
  if (!label) return [];
  return STUDY_LINE_MAP.find((entry) => label.includes(entry.titleContains))?.lines ?? [];
}

function inPensumOrder<T extends StudyTaskLike>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || (a.clientId ?? '').localeCompare(b.clientId ?? ''));
}

const isPending = (t: StudyTaskLike) => !t.deletedAt && (t.status === 'PENDING' || t.status === 'IN_PROGRESS');

/** The session a study block is on: the first pending one of its lines, in order. Null otherwise. */
export function currentStudySession<T extends StudyTaskLike>(label: string | null | undefined, tasks: T[]): T | null {
  for (const line of studyLinesForBlock(label)) {
    const next = inPensumOrder(tasks.filter((t) => studyLineOf(t) === line && isPending(t)))[0];
    if (next) return next;
  }
  return null;
}

export interface StudyLineProgress {
  line: string;
  name: string;
  done: number;
  total: number;
  /** The next pending session's title, if any. */
  next: string | null;
}

/** Sessions done per line, in the order of the map. */
export function studyProgress(tasks: StudyTaskLike[]): StudyLineProgress[] {
  const lines = STUDY_LINE_MAP.flatMap((entry) => entry.lines);
  return lines.map((line) => {
    const own = inPensumOrder(tasks.filter((t) => studyLineOf(t) === line && !t.deletedAt));
    return {
      line,
      name: STUDY_LINE_NAMES[line] ?? line,
      done: own.filter((t) => t.status === 'COMPLETED').length,
      total: own.length,
      next: own.find(isPending)?.title ?? null,
    };
  });
}

/** Quick reasons offered when leaving a block or giving it up; the user can also type one. */
export const BLOCK_EXIT_REASONS = [
  'Cansancio',
  'Una urgencia',
  'Clase o reunión',
  'Me distraje',
  'No entendí el tema',
  'Otra tarea más urgente',
] as const;

/** A block can come up over the screen at most this many times (start + returns): more breaks the focus. */
export const MAX_BLOCK_REMINDERS = 3;

/** The next time a weekly block happens after `from`'s day (a session postponed today goes there). */
export function nextBlockOccurrence(block: { daysOfWeek: number[]; startMinute: number }, from: Date): Date | null {
  for (let offset = 1; offset <= 7; offset++) {
    const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
    if (block.daysOfWeek.includes(day.getDay())) {
      day.setHours(Math.floor(block.startMinute / 60), block.startMinute % 60, 0, 0);
      return day;
    }
  }
  return null;
}

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** "el jueves 8 a las 11:00". */
export function describeOccurrence(date: Date): string {
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `el ${DAY_NAMES[date.getDay()]} ${date.getDate()} a las ${time}`;
}

/**
 * "AN1 · Compacidad (2/3) · pomodoro 1 de 2", or "✓ AN1 · Compacidad (2/3): sesión completada" once
 * it's done -- what the pomodoro is working on, everywhere it's shown.
 */
export function studySessionLine(
  task: Pick<StudyTaskLike, 'title' | 'status' | 'estimatedPomodoros'>,
  pomodoro: { state: string; completedCycles: number },
): string {
  if (task.status === 'COMPLETED') return `✓ ${task.title}: sesión completada`;
  const current = pomodoro.completedCycles + (pomodoro.state === 'FOCUS' ? 1 : 0);
  const total = task.estimatedPomodoros ?? null;
  return total ? `${task.title} · pomodoro ${Math.min(current, total)} de ${total}` : `${task.title} · pomodoro ${current}`;
}
