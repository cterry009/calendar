import { api } from './client.js';
import { TIME_ZONE } from './config.js';

// The snapshot the apps work from (/sync/pull), cached a few seconds so one chat turn with several
// tool calls pulls once.

export interface Project {
  id: string;
  clientId: string | null;
  title: string;
  summary: string | null;
  status: 'ACTIVE' | 'PAUSED' | 'BLOCKED' | 'IDEA' | 'DONE';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  area: string | null;
  color: string | null;
  deadline: string | null;
  progress: number | null;
  nextSteps: string[];
  blocker: string | null;
  generalObjective?: string | null;
  specificObjectives?: Array<{ text: string; done: boolean }>;
  tags?: string[];
  updatedAt: string;
}
export interface LogEntry {
  id: string;
  projectId: string;
  date: string;
  text: string;
  source: 'APP' | 'CLAUDE';
}
export interface Task {
  id: string;
  title: string;
  description: string | null;
  scheduledAt: string | null;
  estimatedMinutes: number;
  estimatedPomodoros: number | null;
  actualMinutes: number | null;
  difficulty: string;
  complexity: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  category: string | null;
  status: string;
  completedAt: string | null;
  deletedAt: string | null;
  projectId?: string | null;
}
export interface Schedule {
  id: string;
  kind: 'WORK' | 'REST';
  daysOfWeek: number[];
  startMinute: number;
  endMinute: number;
  label: string | null;
  enabled: boolean;
  category?: string | null;
}
export interface Snapshot {
  tasks: Task[];
  schedules: Schedule[];
  projects?: Project[];
  projectLogEntries?: LogEntry[];
}

let cache: { at: number; snap: Snapshot } | null = null;

export async function snapshot(): Promise<Snapshot> {
  if (cache && Date.now() - cache.at < 10_000) return cache.snap;
  const snap = await api<Snapshot>('/sync/pull');
  cache = { at: Date.now(), snap };
  return snap;
}

export function invalidate(): void {
  cache = null;
}

export interface BatchResult {
  applied: Record<string, unknown[] | undefined>;
  conflicts: Record<string, unknown[] | undefined>;
}

/** One change per batch; reports what the server did with it. */
export async function sendChange(entity: string, change: Record<string, unknown>): Promise<string> {
  const res = await api<BatchResult>('/sync/batch', { method: 'POST', body: JSON.stringify({ [entity]: [change] }) });
  invalidate();
  const conflicts = res.conflicts?.[entity] ?? [];
  if (conflicts.length) return `No se aplicó: conflicto (${JSON.stringify(conflicts[0]).slice(0, 200)}).`;
  return 'Aplicado; los demás dispositivos se actualizan solos.';
}

/** YYYY-MM-DD of a date in the user's time zone. */
export function dayKey(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** 0 = Sunday … 6 = Saturday, in the user's time zone. */
export function weekday(d: Date = new Date()): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, weekday: 'short' }).format(d);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
}

export function localTime(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** A local "YYYY-MM-DDTHH:mm" (Bogotá has no DST) or a full ISO string, as ISO. */
export function toIso(local: string): string {
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(local)) return new Date(local).toISOString();
  const offset = TIME_ZONE === 'America/Bogota' ? '-05:00' : '';
  const withTime = local.length === 10 ? `${local}T09:00` : local;
  return new Date(`${withTime}${offset}`).toISOString();
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** A project by id, client id, or a piece of its title (accents and case ignored). */
export function findProject(projects: Project[], ref: string): Project {
  const exact = projects.find((p) => p.id === ref || p.clientId === ref);
  if (exact) return exact;
  const q = fold(ref);
  const hits = projects.filter((p) => fold(p.title).includes(q));
  if (hits.length === 1) return hits[0];
  if (!hits.length) throw new Error(`No hay un proyecto que coincida con "${ref}". Usa la herramienta proyectos para ver los nombres.`);
  throw new Error(`"${ref}" coincide con varios proyectos: ${hits.map((p) => p.title).join('; ')}. Sé más específico.`);
}

export const AREAS: Record<string, string> = {
  'habitos-deporte': 'Hábitos y deporte',
  trabajo: 'Trabajo',
  personal: 'Personal',
  ocio: 'Ocio',
  'academico-estudio': 'Académico · Estudio',
  'academico-maestria': 'Académico · Maestría',
  'academico-papers': 'Académico · Papers e investigadores',
};

/** The whole project as a sync change: the server fills omitted fields with defaults. */
export function projectChange(p: Project, patch: Partial<Project>): Record<string, unknown> {
  const n = { ...p, ...patch };
  return {
    id: n.id,
    updatedAt: new Date().toISOString(),
    title: n.title,
    summary: n.summary,
    status: n.status,
    priority: n.priority,
    area: n.area,
    color: n.color,
    deadline: n.deadline ? n.deadline.slice(0, 10) : null,
    progress: n.progress,
    nextSteps: n.nextSteps,
    blocker: n.blocker,
    generalObjective: n.generalObjective ?? null,
    specificObjectives: n.specificObjectives ?? [],
    tags: n.tags ?? [],
  };
}

export function taskChange(t: Task, patch: Partial<Task>): Record<string, unknown> {
  const n = { ...t, ...patch };
  const opt = <T>(v: T | null | undefined) => (v === null ? undefined : v);
  return {
    id: n.id,
    updatedAt: new Date().toISOString(),
    title: n.title,
    description: opt(n.description),
    scheduledAt: opt(n.scheduledAt),
    estimatedMinutes: n.estimatedMinutes,
    estimatedPomodoros: opt(n.estimatedPomodoros),
    actualMinutes: opt(n.actualMinutes),
    difficulty: n.difficulty,
    complexity: n.complexity,
    priority: n.priority,
    category: opt(n.category),
    status: n.status,
    completedAt: opt(n.completedAt),
  };
}
