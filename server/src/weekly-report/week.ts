// The Sunday report's data (weekend-mode, user 2026-11-04: "toma estadísticas de todo y envíame un
// reporte los domingos en la tarde para yo hacer un análisis"). Pure: the service gathers rows into
// a WeekData, and everything shown -- the email, the CSV, the JSON, the presentation -- comes from
// it, so the attachments and the slides never disagree.

export const WEEKDAY_SHORT = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

export interface DayRow {
  /** YYYY-MM-DD, local. */
  date: string;
  /** "lun" ... "dom". */
  weekday: string;
  focusMinutes: number;
  pomodoros: number;
  /** WORK blocks the schedule had that day (a flexible window counts its blocks). */
  blocksPlanned: number;
  blocksStarted: number;
  /** A flexible block with 45+ min of focus, or a fixed one with a pomodoro done. */
  blocksDone: number;
  /** Marked "no puedo". */
  blocksSkipped: number;
  tasksCompleted: number;
  /** Scheduled that day and still not done. */
  tasksLeftover: number;
  exerciseAttempts: number;
  /** Graded 1 (right). */
  exerciseCorrect: number;
  phoneMinutes: number | null;
  phoneSocialMinutes: number | null;
  pcMinutes: number | null;
  gameMinutes: number | null;
  lolMinutes: number | null;
  /** Tries to open something blocked (focus or night). */
  blockAttempts: number;
  nightBlockAttempts: number;
  /** Local minute of the first phone use after the night, and of the morning unlock. */
  firstUseMinute: number | null;
  unlockMinute: number | null;
  /** "Sí, ya hice" to "¿Ya hiciste ejercicio?". */
  exercisedOnWake: boolean;
  steps: number | null;
  floors: number | null;
  workoutMinutes: number;
  habitsDone: number;
  habitsPlanned: number;
  weekendActivitiesDone: number;
  weekendActivitiesPlanned: number;
}

export interface WeekTotals {
  focusMinutes: number;
  pomodoros: number;
  blocksPlanned: number;
  blocksDone: number;
  blocksSkipped: number;
  /** blocksDone / blocksPlanned, 0..1; null with nothing planned. */
  scheduleRate: number | null;
  tasksCompleted: number;
  tasksLeftover: number;
  exerciseAttempts: number;
  exerciseCorrect: number;
  phoneMinutes: number;
  phoneSocialMinutes: number;
  pcMinutes: number;
  gameMinutes: number;
  lolMinutes: number;
  blockAttempts: number;
  nightBlockAttempts: number;
  steps: number;
  workoutMinutes: number;
  habitsDone: number;
  habitsPlanned: number;
  weekendActivitiesDone: number;
  weekendActivitiesPlanned: number;
  /** Mean local minute of the first phone use, over the days it's known. */
  avgFirstUseMinute: number | null;
}

export interface NamedMinutes {
  label: string;
  minutes: number;
}

export interface WeekData {
  /** Monday and Sunday, local (YYYY-MM-DD). */
  weekStart: string;
  weekEnd: string;
  generatedAt: string;
  timeZone: string;
  days: DayRow[];
  totals: WeekTotals;
  /** The week before, for the arrows; null for a first week. */
  previous: WeekTotals | null;
  /** Focus by schedule category ("estudio_b1", "carrera", ...), most first. */
  focusByCategory: NamedMinutes[];
  /** Blocks most often marked "no puedo" or started and not done. */
  missedBlocks: Array<{ label: string; count: number }>;
  topPhoneApps: NamedMinutes[];
  topPcApps: NamedMinutes[];
  topGames: NamedMinutes[];
  /** Blocked open attempts by what was opened. */
  blockedTargets: Array<{ label: string; count: number }>;
  /** [weekday 0 = Monday][hour 0..23] -> blocked open attempts. */
  blockHeatmap: number[][];
  habits: Array<{ title: string; done: number; planned: number }>;
  weekendActivities: Array<{ title: string; day: string; time: string | null; done: boolean }>;
  study: {
    sections: Array<{ key: string; attempts: number; meanGrade: number }>;
  };
  /** Totals of up to the 4 weeks before this one, oldest first, for the trend slide. */
  history: Array<{ weekStart: string; totals: WeekTotals }>;
  /** 3-5 lines computed from the numbers (no AI). */
  highlights: string[];
}

function sum(days: DayRow[], pick: (d: DayRow) => number | null): number {
  return days.reduce((total, d) => total + (pick(d) ?? 0), 0);
}

export function weekTotals(days: DayRow[]): WeekTotals {
  const firstUses = days.map((d) => d.firstUseMinute).filter((m): m is number => m !== null);
  const blocksPlanned = sum(days, (d) => d.blocksPlanned);
  const blocksDone = sum(days, (d) => d.blocksDone);
  return {
    focusMinutes: sum(days, (d) => d.focusMinutes),
    pomodoros: sum(days, (d) => d.pomodoros),
    blocksPlanned,
    blocksDone,
    blocksSkipped: sum(days, (d) => d.blocksSkipped),
    scheduleRate: blocksPlanned ? Math.min(1, blocksDone / blocksPlanned) : null,
    tasksCompleted: sum(days, (d) => d.tasksCompleted),
    tasksLeftover: sum(days, (d) => d.tasksLeftover),
    exerciseAttempts: sum(days, (d) => d.exerciseAttempts),
    exerciseCorrect: sum(days, (d) => d.exerciseCorrect),
    phoneMinutes: sum(days, (d) => d.phoneMinutes),
    phoneSocialMinutes: sum(days, (d) => d.phoneSocialMinutes),
    pcMinutes: sum(days, (d) => d.pcMinutes),
    gameMinutes: sum(days, (d) => d.gameMinutes),
    lolMinutes: sum(days, (d) => d.lolMinutes),
    blockAttempts: sum(days, (d) => d.blockAttempts),
    nightBlockAttempts: sum(days, (d) => d.nightBlockAttempts),
    steps: sum(days, (d) => d.steps),
    workoutMinutes: sum(days, (d) => d.workoutMinutes),
    habitsDone: sum(days, (d) => d.habitsDone),
    habitsPlanned: sum(days, (d) => d.habitsPlanned),
    weekendActivitiesDone: sum(days, (d) => d.weekendActivitiesDone),
    weekendActivitiesPlanned: sum(days, (d) => d.weekendActivitiesPlanned),
    avgFirstUseMinute: firstUses.length ? Math.round(firstUses.reduce((a, b) => a + b, 0) / firstUses.length) : null,
  };
}

export function hhmm(minute: number): string {
  return `${String(Math.floor(minute / 60) % 24).padStart(2, '0')}:${String(Math.round(minute) % 60).padStart(2, '0')}`;
}

export function hoursText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** +12 %, −30 %; null without a base to compare with. */
export function changePercent(now: number, before: number | null | undefined): number | null {
  if (before === null || before === undefined || before === 0) return null;
  return Math.round(((now - before) / before) * 100);
}

/** Which way is good for a metric: focus up is good, game time up is bad. */
export const LOWER_IS_BETTER = new Set<keyof WeekTotals>([
  'phoneMinutes',
  'phoneSocialMinutes',
  'gameMinutes',
  'lolMinutes',
  'blockAttempts',
  'nightBlockAttempts',
  'blocksSkipped',
  'tasksLeftover',
  'avgFirstUseMinute',
]);

interface Comparable {
  key: keyof WeekTotals;
  name: string;
  /** Changes smaller than this (in the metric's unit) aren't worth a line. */
  minDelta: number;
  format: (value: number) => string;
}

const COMPARABLE: Comparable[] = [
  { key: 'focusMinutes', name: 'el foco', minDelta: 60, format: hoursText },
  { key: 'gameMinutes', name: 'el tiempo de juego', minDelta: 30, format: hoursText },
  { key: 'phoneSocialMinutes', name: 'las redes en el teléfono', minDelta: 30, format: hoursText },
  { key: 'steps', name: 'los pasos', minDelta: 5000, format: (v) => v.toLocaleString('es-CO') },
  { key: 'exerciseAttempts', name: 'los ejercicios', minDelta: 5, format: (v) => String(v) },
  { key: 'blockAttempts', name: 'los intentos de abrir algo bloqueado', minDelta: 5, format: (v) => String(v) },
];

/** The lines at the top of the report: best and worst change, best and worst day, the schedule. */
export function weekHighlights(data: Pick<WeekData, 'days' | 'totals' | 'previous'>): string[] {
  const lines: string[] = [];
  const { totals, previous, days } = data;
  if (totals.scheduleRate !== null) {
    lines.push(
      `Cumpliste ${Math.round(totals.scheduleRate * 100)} % de los bloques (${totals.blocksDone} de ${totals.blocksPlanned}), con ${hoursText(totals.focusMinutes)} de foco.`,
    );
  } else {
    lines.push(`${hoursText(totals.focusMinutes)} de foco en la semana.`);
  }
  if (previous) {
    const changes = COMPARABLE.map((c) => {
      const now = totals[c.key] as number;
      const before = previous[c.key] as number;
      const delta = now - before;
      const good = LOWER_IS_BETTER.has(c.key) ? delta < 0 : delta > 0;
      return { c, now, before, delta, good, pct: changePercent(now, before) };
    }).filter((x) => Math.abs(x.delta) >= x.c.minDelta);
    const describe = (x: (typeof changes)[number]) =>
      `${x.delta > 0 ? 'Subió' : 'Bajó'} ${x.c.name}: ${x.c.format(x.now)}${x.pct !== null ? ` (${x.pct > 0 ? '+' : ''}${x.pct} %)` : ''}.`;
    const better = changes.filter((x) => x.good).sort((a, b) => Math.abs(b.pct ?? 0) - Math.abs(a.pct ?? 0))[0];
    const worse = changes.filter((x) => !x.good).sort((a, b) => Math.abs(b.pct ?? 0) - Math.abs(a.pct ?? 0))[0];
    if (better) lines.push(`Mejoró: ${describe(better).toLowerCase()}`);
    if (worse) lines.push(`Empeoró: ${describe(worse).toLowerCase()}`);
  }
  const worked = days.filter((d) => d.focusMinutes > 0);
  if (worked.length >= 2) {
    const best = [...worked].sort((a, b) => b.focusMinutes - a.focusMinutes)[0];
    const weekdays = days.slice(0, 5);
    const worst = [...weekdays].sort((a, b) => a.focusMinutes - b.focusMinutes)[0];
    lines.push(
      `Mejor día: ${best.weekday} (${hoursText(best.focusMinutes)} de foco). Más flojo entre semana: ${worst.weekday} (${hoursText(worst.focusMinutes)}).`,
    );
  }
  if (totals.lolMinutes > 0) lines.push(`League of Legends: ${hoursText(totals.lolMinutes)} en la semana.`);
  return lines;
}

const CSV_COLUMNS: Array<[keyof DayRow, string]> = [
  ['date', 'fecha'],
  ['weekday', 'dia'],
  ['focusMinutes', 'foco_min'],
  ['pomodoros', 'pomodoros'],
  ['blocksPlanned', 'bloques_planeados'],
  ['blocksStarted', 'bloques_empezados'],
  ['blocksDone', 'bloques_hechos'],
  ['blocksSkipped', 'bloques_no_puedo'],
  ['tasksCompleted', 'tareas_hechas'],
  ['tasksLeftover', 'tareas_pendientes'],
  ['exerciseAttempts', 'ejercicios'],
  ['exerciseCorrect', 'ejercicios_bien'],
  ['phoneMinutes', 'telefono_min'],
  ['phoneSocialMinutes', 'telefono_redes_min'],
  ['pcMinutes', 'pc_min'],
  ['gameMinutes', 'juegos_min'],
  ['lolMinutes', 'lol_min'],
  ['blockAttempts', 'intentos_bloqueados'],
  ['nightBlockAttempts', 'intentos_bloqueados_noche'],
  ['firstUseMinute', 'primer_uso'],
  ['unlockMinute', 'desbloqueo_manana'],
  ['exercisedOnWake', 'ejercicio_al_despertar'],
  ['steps', 'pasos'],
  ['floors', 'pisos'],
  ['workoutMinutes', 'ejercicio_min'],
  ['habitsDone', 'habitos_hechos'],
  ['habitsPlanned', 'habitos_planeados'],
  ['weekendActivitiesDone', 'actividades_finde_hechas'],
  ['weekendActivitiesPlanned', 'actividades_finde_planeadas'],
];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? '1' : '0';
  const text = String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** One row per day, every metric a column; times of day as HH:MM. Comma-separated, UTF-8 with BOM (Excel). */
export function weekCsv(data: WeekData): string {
  const header = CSV_COLUMNS.map(([, name]) => name).join(',');
  const rows = data.days.map((day) =>
    CSV_COLUMNS.map(([key]) => {
      const value = day[key];
      if ((key === 'firstUseMinute' || key === 'unlockMinute') && typeof value === 'number') return hhmm(value);
      return csvCell(value);
    }).join(','),
  );
  return `﻿${[header, ...rows].join('\r\n')}\r\n`;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "3–9 nov 2026", "27 oct – 2 nov 2026". */
export function weekRangeText(weekStart: string, weekEnd: string): string {
  const [y1, m1, d1] = weekStart.split('-').map(Number);
  const [y2, m2, d2] = weekEnd.split('-').map(Number);
  if (y1 === y2 && m1 === m2) return `${d1}–${d2} ${MONTHS[m2 - 1]} ${y2}`;
  return `${d1} ${MONTHS[m1 - 1]} – ${d2} ${MONTHS[m2 - 1]} ${y2}`;
}
