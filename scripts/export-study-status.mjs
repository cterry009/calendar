#!/usr/bin/env node
// Writes the study status into the Obsidian vault ("Notas de Fisica") so the user, Claude or any
// other AI can read how the study plan is going without opening the app (user-requested,
// 2026-10-21): progress per pensum, study time per week, how the pomodoros were rated, and the
// plan's week, phase and milestones. Two files with the same data:
//   Estado_estudio.md     -- for reading in Obsidian; its "Notas" section is written by hand
//   estado_estudio.json   -- for an AI to read without parsing tables
//
// The data comes from the app (GET /sync/pull and GET /sync/focus-events), so a session only counts
// as done once it's marked done in the app (the end-of-block card, "¿terminaste la sesión?").
// Everything is regenerated on every run except the text between the `notas` markers, which is
// kept as it is.
//
// Usage (from the repo root, after `npm run build:shared`, with the API up):
//   node scripts/export-study-status.mjs              # writes both files into the vault
//   node scripts/export-study-status.mjs --dry-run    # prints the markdown instead
//
// Options / env (same as import-study-notes.mjs):
//   --vault <path>    CALENDAR_VAULT     default: %USERPROFILE%/Documents/Notas de Fisica
//   --api <url>       CALENDAR_API_URL   default: http://localhost:3000
//   --email <email>   CALENDAR_EMAIL     default: dev@local.test
//   CALENDAR_PASSWORD (env only)

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  addDaysToKey,
  localDateKey,
  phaseForWeek,
  planWeekOf,
  planWeekStart,
  PLAN_CATEGORY_INFO,
  STUDY_LINE_MAP,
  STUDY_LINE_NAMES,
  studyLineOf,
  weekProgress,
} from '../packages/shared/dist/index.js';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const dryRun = process.argv.includes('--dry-run');
const vault = arg('vault', process.env.CALENDAR_VAULT ?? join(homedir(), 'Documents', 'Notas de Fisica'));
const api = arg('api', process.env.CALENDAR_API_URL ?? 'http://localhost:3000');
const email = arg('email', process.env.CALENDAR_EMAIL ?? 'dev@local.test');
const password = process.env.CALENDAR_PASSWORD ?? 'devpassword123';

const MD_FILE = join(vault, 'Estado_estudio.md');
const JSON_FILE = join(vault, 'estado_estudio.json');
const NOTES_START = '<!-- notas:inicio -->';
const NOTES_END = '<!-- notas:fin -->';
const DEFAULT_NOTES = [
  '- Dudas abiertas:',
  '- Ejercicios atrasados para el sábado:',
  '- Decisiones o cambios de plan:',
].join('\n');

/** Weeks of history shown in the time table (calendar weeks, Monday first). */
const HISTORY_WEEKS = 6;
/** Days the focus-quality section looks back. */
const QUALITY_DAYS = 28;
const STUDY_CATEGORIES = ['estudio_b1', 'estudio_b2', 'pilar_e', 'repaso'];
const DAY_MS = 24 * 60 * 60 * 1000;

async function request(path, init = {}, token) {
  const res = await fetch(`${api}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

const { accessToken } = await request('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password, deviceLabel: 'export-study-status', devicePlatform: 'WEB' }),
});
const snapshot = await request('/sync/pull', {}, accessToken);
const focusEvents = await request(
  `/sync/focus-events?since=${encodeURIComponent(new Date(Date.now() - 120 * DAY_MS).toISOString())}`,
  {},
  accessToken,
);

const now = new Date();
const today = localDateKey(now);
const tasks = (snapshot.tasks ?? []).filter((t) => !t.deletedAt);
const schedules = snapshot.schedules ?? [];
const exceptions = snapshot.scheduleExceptions ?? [];
const sessions = snapshot.pomodoroSessions ?? [];
const plan = snapshot.studyPlan?.planData ?? null;

const pct = (done, total) => (total ? Math.round((100 * done) / total) : 0);
const round1 = (n) => Math.round(n * 10) / 10;
const mondayOf = (key) => addDaysToKey(key, -((new Date(`${key}T12:00:00`).getDay() + 6) % 7));
const categoryName = (c) => PLAN_CATEGORY_INFO[c]?.name ?? c;
const sessionDate = (s) => {
  const when = s.blockStartAt ?? s.startedAt ?? s.createdAt;
  return when ? localDateKey(new Date(when)) : null;
};
const LABEL_CATEGORIES = [
  ['Estudio B1', 'estudio_b1'],
  ['Estudio B2', 'estudio_b2'],
  ['Pilar E', 'pilar_e'],
];
const BLOCK_CATEGORY = { 'Estudio B1': 'estudio_b1', 'Estudio B2': 'estudio_b2' };
/**
 * The plan category of a pomodoro: the block's that day (an exception wins). Blocks from before the
 * timetable (2026-10-19) have no category, so their label decides, and failing that, the study
 * session the pomodoro was on.
 */
function categoryOf(scheduleId, dateKey, taskId) {
  const exception = scheduleId
    ? exceptions.find((e) => e.scheduleId === scheduleId && e.date?.slice(0, 10) === dateKey && !e.deletedAt)
    : null;
  const schedule = scheduleId ? schedules.find((s) => s.id === scheduleId) : null;
  const fromLabel = LABEL_CATEGORIES.find(([text]) => schedule?.label?.includes(text))?.[1];
  const line = taskId ? studyLineOf(tasks.find((t) => t.id === taskId) ?? {}) : null;
  const fromTask = line ? BLOCK_CATEGORY[STUDY_LINE_MAP.find((e) => e.lines.includes(line))?.titleContains] : null;
  return exception?.category ?? schedule?.category ?? fromLabel ?? fromTask ?? null;
}
const sessionCategory = (s) => categoryOf(s.scheduleId, sessionDate(s), s.taskId);
/** Focus minutes of a session: its finished focus segments (sequence) or cycles x focus length. */
function focusMinutes(session) {
  const cycles = session.completedCycles ?? 0;
  if (Array.isArray(session.sequence) && session.sequence.length) {
    return session.sequence
      .filter((seg) => seg.tipo === 'foco')
      .slice(0, cycles)
      .reduce((sum, seg) => sum + (seg.minutos ?? 0), 0);
  }
  return cycles * (session.focusDurationMin ?? 25);
}

// ─── Plan ──────────────────────────────────────────────────────────────────

const planWeek = plan ? planWeekOf(plan, today) : null;
const phase = plan && planWeek >= 1 ? phaseForWeek(plan, planWeek) : null;
const milestoneTasks = tasks
  .filter((t) => t.clientId?.startsWith('hito:'))
  .map((t) => ({
    semana: Number(t.clientId.split(':')[1]),
    titulo: t.title,
    categoria: t.category ?? null,
    fecha: t.scheduledAt ? localDateKey(new Date(t.scheduledAt)) : null,
    hecho: t.status === 'COMPLETED',
    completadoEl: t.completedAt ? localDateKey(new Date(t.completedAt)) : null,
  }))
  .sort((a, b) => a.semana - b.semana || a.titulo.localeCompare(b.titulo));
const milestones = {
  total: milestoneTasks.length,
  hechos: milestoneTasks.filter((m) => m.hecho).length,
  atrasados: planWeek ? milestoneTasks.filter((m) => !m.hecho && m.semana < planWeek) : [],
  estaSemana: planWeek ? milestoneTasks.filter((m) => m.semana === planWeek) : [],
  proximos: planWeek ? milestoneTasks.filter((m) => !m.hecho && m.semana > planWeek && m.semana <= planWeek + 2) : [],
  todos: milestoneTasks,
};

// ─── Progress per pensum ───────────────────────────────────────────────────

const studyTasks = tasks.filter((t) => studyLineOf(t));
const pomodorosByTask = new Map();
const minutesByTask = new Map();
for (const s of sessions) {
  if (!s.taskId) continue;
  pomodorosByTask.set(s.taskId, (pomodorosByTask.get(s.taskId) ?? 0) + (s.completedCycles ?? 0));
  minutesByTask.set(s.taskId, (minutesByTask.get(s.taskId) ?? 0) + focusMinutes(s));
}
const inOrder = (list) =>
  [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || (a.clientId ?? '').localeCompare(b.clientId ?? ''));
const isPending = (t) => t.status === 'PENDING' || t.status === 'IN_PROGRESS';
const blockOfLine = (line) => STUDY_LINE_MAP.find((e) => e.lines.includes(line))?.titleContains ?? null;

// Every pensum that has imported sessions, in the map's order first and then the rest.
const mappedLines = STUDY_LINE_MAP.flatMap((e) => e.lines);
const allLines = [...new Set([...mappedLines, ...studyTasks.map(studyLineOf)])];
const lines = allLines.map((line) => {
  const own = inOrder(studyTasks.filter((t) => studyLineOf(t) === line));
  const next = own.find(isPending) ?? null;
  return {
    pensum: line,
    nombre: STUDY_LINE_NAMES[line] ?? line.replace(/^pensum_|\.md$/g, ''),
    bloque: blockOfLine(line),
    hechas: own.filter((t) => t.status === 'COMPLETED').length,
    total: own.length,
    porcentaje: pct(own.filter((t) => t.status === 'COMPLETED').length, own.length),
    siguiente: next ? next.title : null,
    pomodorosEnLaSiguiente: next ? pomodorosByTask.get(next.id) ?? 0 : 0,
    pomodoros: own.reduce((sum, t) => sum + (pomodorosByTask.get(t.id) ?? 0), 0),
    minutosFoco: own.reduce((sum, t) => sum + (minutesByTask.get(t.id) ?? 0), 0),
  };
});
// Sessions with pomodoros on them that aren't marked done: the likely gap between the app and reality.
const startedNotDone = inOrder(studyTasks.filter((t) => isPending(t) && (pomodorosByTask.get(t.id) ?? 0) > 0)).map((t) => ({
  sesion: t.title,
  pensum: studyLineOf(t),
  pomodoros: pomodorosByTask.get(t.id) ?? 0,
  minutosFoco: minutesByTask.get(t.id) ?? 0,
}));
const recentlyDone = studyTasks
  .filter((t) => t.status === 'COMPLETED' && t.completedAt)
  .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
  .slice(0, 8)
  .map((t) => ({ sesion: t.title, fecha: localDateKey(new Date(t.completedAt)) }));
// The study lines with a block in the plan but no imported sessions (the Pilar E pensum, for now).
const linesWithoutSessions = ['pensum_pilar_E.md'].filter((line) => !studyTasks.some((t) => studyLineOf(t) === line));

// ─── Study time ────────────────────────────────────────────────────────────

const thisMonday = mondayOf(today);
const weeks = Array.from({ length: HISTORY_WEEKS }, (_, i) => addDaysToKey(thisMonday, -7 * (HISTORY_WEEKS - 1 - i))).map(
  (weekStart) => {
    const weekEnd = addDaysToKey(weekStart, 7);
    const own = sessions.filter((s) => {
      const d = sessionDate(s);
      return d && d >= weekStart && d < weekEnd;
    });
    // weekProgress gives the cuts; the categories are counted here, with the fallback for old blocks.
    const progress = weekProgress(sessions, schedules, exceptions, weekStart);
    const pomodorosByCategory = {};
    const minutesByCategory = {};
    for (const s of own) {
      const category = sessionCategory(s) ?? 'sin_categoria';
      pomodorosByCategory[category] = (pomodorosByCategory[category] ?? 0) + (s.completedCycles ?? 0);
      minutesByCategory[category] = (minutesByCategory[category] ?? 0) + focusMinutes(s);
    }
    const studyPomodoros = STUDY_CATEGORIES.reduce((sum, c) => sum + (pomodorosByCategory[c] ?? 0), 0);
    const studyMinutes = STUDY_CATEGORIES.reduce((sum, c) => sum + (minutesByCategory[c] ?? 0), 0);
    return {
      lunes: weekStart,
      semanaDelPlan: plan ? planWeekOf(plan, weekStart) : null,
      pomodorosPorCategoria: pomodorosByCategory,
      minutosPorCategoria: minutesByCategory,
      pomodorosEstudio: studyPomodoros,
      minutosEstudio: studyMinutes,
      pomodorosTotales: own.reduce((sum, s) => sum + (s.completedCycles ?? 0), 0),
      minutosTotales: own.reduce((sum, s) => sum + focusMinutes(s), 0),
      cortesDeTramo: progress.cuts,
      diasConEstudio: new Set(
        own.filter((s) => (s.completedCycles ?? 0) > 0 && STUDY_CATEGORIES.includes(sessionCategory(s))).map(sessionDate),
      ).size,
    };
  },
);

// Streak: consecutive days, up to today (or yesterday if today has nothing yet), with a finished
// study pomodoro. Sundays don't break it (the plan has them free).
const studyDays = new Set(
  sessions
    .filter((s) => (s.completedCycles ?? 0) > 0 && STUDY_CATEGORIES.includes(sessionCategory(s)))
    .map(sessionDate),
);
let streak = 0;
for (let day = studyDays.has(today) ? today : addDaysToKey(today, -1); ; day = addDaysToKey(day, -1)) {
  if (studyDays.has(day)) streak += 1;
  else if (new Date(`${day}T12:00:00`).getDay() !== 0) break;
  if (streak > 365) break;
}
const lastStudyDay = [...studyDays].sort().at(-1) ?? null;

// ─── Focus quality ─────────────────────────────────────────────────────────

const qualitySince = new Date(now.getTime() - QUALITY_DAYS * DAY_MS);
const recentEvents = focusEvents.filter((e) => new Date(e.occurredAt) >= qualitySince);
// One rating per pomodoro: a card answered twice (seen 2026-10-07, a double tap) counts once.
const reviewsByKey = new Map();
for (const e of recentEvents) {
  if (e.kind !== 'CHECK_IN' || !e.meta?.review) continue;
  reviewsByKey.set(`${e.pomodoroSessionId ?? e.id}#${e.meta.cycle ?? ''}`, e);
}
const reviews = [...reviewsByKey.values()].map((e) => {
  const date = localDateKey(new Date(e.occurredAt));
  const task = e.taskId ? tasks.find((t) => t.id === e.taskId) : null;
  return {
    fecha: date,
    calificacion: e.meta.rating ?? e.value,
    categoria: categoryOf(e.scheduleId, date, e.taskId),
    sesion: task?.title ?? null,
    etiquetas: e.meta.tags ?? [],
    comentario: e.meta.comment ?? null,
    sesionTerminada: e.meta.sessionDone ?? null,
  };
});
const average = (list) => (list.length ? round1(list.reduce((s, r) => s + r.calificacion, 0) / list.length) : null);
const distribution = Object.fromEntries([1, 2, 3, 4, 5].map((v) => [v, reviews.filter((r) => r.calificacion === v).length]));
const tagCounts = {};
for (const r of reviews) for (const tag of r.etiquetas) tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
const countKind = (kind) => recentEvents.filter((e) => e.kind === kind).length;
const exitReasons = {};
for (const e of recentEvents) {
  if (e.kind !== 'BLOCK_EXIT_REASON' || !e.meta?.reason) continue;
  exitReasons[e.meta.reason] = (exitReasons[e.meta.reason] ?? 0) + 1;
}
const quality = {
  dias: QUALITY_DAYS,
  calificaciones: reviews.length,
  promedio: average(reviews),
  promedioEstudio: average(reviews.filter((r) => STUDY_CATEGORIES.includes(r.categoria))),
  distribucion: distribution,
  etiquetas: Object.fromEntries(Object.entries(tagCounts).sort((a, b) => b[1] - a[1])),
  comentariosRecientes: reviews.filter((r) => r.comentario).slice(-6).reverse(),
  cortesDeTramo: countKind('SEGMENT_CUT'),
  salidasDelBloque: countKind('BLOCK_EXITED'),
  motivosDeSalida: exitReasons,
  bloquesSaltados: countKind('BLOCK_SKIPPED'),
  sesionesCanceladas: countKind('SESSION_CANCELLED'),
  pomodorosTerminados: countKind('FOCUS_COMPLETED'),
};

// ─── Output ────────────────────────────────────────────────────────────────

const totalDone = lines.reduce((s, l) => s + l.hechas, 0);
const totalSessions = lines.reduce((s, l) => s + l.total, 0);
const thisWeek = weeks.at(-1);

let manualNotes = DEFAULT_NOTES;
if (existsSync(MD_FILE)) {
  const previous = readFileSync(MD_FILE, 'utf8');
  const start = previous.indexOf(NOTES_START);
  const end = previous.indexOf(NOTES_END);
  if (start >= 0 && end > start) manualNotes = previous.slice(start + NOTES_START.length, end).trim();
}

const status = {
  version: 1,
  generadoEl: now.toISOString(),
  comoRegenerar: 'node scripts/export-study-status.mjs (en Proyectos/calendar, con la API corriendo)',
  plan: plan
    ? {
        inicio: plan.startDate,
        semanas: plan.weeks ?? 14,
        semanaActual: planWeek,
        fase: phase?.nombre ?? null,
        contenidoDeLaFase: phase?.contenido ?? null,
        finDelPlan: planWeekStart(plan, (plan.weeks ?? 14) + 1),
      }
    : null,
  resumen: {
    sesionesHechas: totalDone,
    sesionesTotales: totalSessions,
    porcentaje: pct(totalDone, totalSessions),
    pomodorosEstudioEstaSemana: thisWeek.pomodorosEstudio,
    minutosEstudioEstaSemana: thisWeek.minutosEstudio,
    racha: streak,
    ultimoDiaDeEstudio: lastStudyDay,
    calificacionPromedio: quality.promedio,
  },
  avancePorPensum: lines,
  pensumsSinSesiones: linesWithoutSessions,
  sesionesEmpezadasSinMarcar: startedNotDone,
  ultimasSesionesTerminadas: recentlyDone,
  tiempoPorSemana: weeks,
  calidadDelFoco: quality,
  hitos: milestones,
  notasManuales: manualNotes,
};

const hm = (minutes) => (minutes >= 60 ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min` : `${minutes} min`);
const cell = (s) => String(s ?? '—').replace(/\|/g, '\\|');
const md = [];
md.push('# Estado del estudio');
md.push('');
md.push(`Volver a [[00_Intro]] · Plan en [[Horario]]. Generado el ${today} a las ${now.toTimeString().slice(0, 5)} desde la app de calendario.`);
md.push('');
md.push('> [!info] Cómo usar este archivo');
md.push('> Todo se regenera con `node scripts/export-study-status.mjs` (en `Proyectos/calendar`, con la API corriendo), salvo la sección **Notas**, que se escribe a mano y se conserva. Los mismos datos están en `estado_estudio.json`. Una sesión cuenta como hecha solo cuando se marca en la app (la tarjeta del final del bloque). Si los datos parecen viejos, mira la fecha de arriba y regenera.');
md.push('');
md.push('## Resumen');
md.push('');
if (plan) {
  md.push(`- **Plan:** semana ${planWeek} de ${plan.weeks ?? 14} (empezó el ${plan.startDate}). ${phase ? `**${phase.nombre}**.` : planWeek < 1 ? 'Todavía no empieza.' : 'Ya terminó.'}`);
} else {
  md.push('- **Plan:** no hay horario cargado en la app.');
}
md.push(`- **Sesiones de pensum:** ${totalDone} de ${totalSessions} (${pct(totalDone, totalSessions)} %).`);
md.push(`- **Esta semana:** ${thisWeek.pomodorosEstudio} pomodoros de estudio (${hm(thisWeek.minutosEstudio)}), ${thisWeek.diasConEstudio} días con estudio.`);
md.push(`- **Racha:** ${streak} ${streak === 1 ? 'día' : 'días'} seguidos con estudio${lastStudyDay ? ` (último: ${lastStudyDay})` : ''}. Los domingos no la cortan.`);
md.push(`- **Foco (últimos ${QUALITY_DAYS} días):** ${quality.calificaciones} pomodoros calificados, promedio ${quality.promedio ?? '—'} / 5.`);
if (milestones.atrasados.length) md.push(`- **Hitos atrasados:** ${milestones.atrasados.length}.`);
md.push('');
md.push('## Notas');
md.push('');
md.push('Escritas a mano por ti o por una IA. El script no las toca.');
md.push('');
md.push(NOTES_START);
md.push(manualNotes);
md.push(NOTES_END);
md.push('');
md.push('## Avance por pensum');
md.push('');
md.push('| Pensum | Bloque | Hechas | % | Pomodoros | Foco | Sesión actual |');
md.push('|---|---|:-:|:-:|:-:|:-:|---|');
for (const l of lines) {
  const current = l.siguiente ? `${l.siguiente}${l.pomodorosEnLaSiguiente ? ` (${l.pomodorosEnLaSiguiente} pom.)` : ''}` : l.total ? '✓ terminado' : '—';
  md.push(`| ${cell(l.nombre)} | ${cell(l.bloque)} | ${l.hechas}/${l.total} | ${l.porcentaje} | ${l.pomodoros} | ${hm(l.minutosFoco)} | ${cell(current)} |`);
}
md.push('');
md.push('Cada bloque toma las sesiones de sus pensums en orden y termina uno antes de pasar al siguiente: la "sesión actual" es la que le toca al próximo bloque de esa línea.');
if (linesWithoutSessions.length) {
  md.push('');
  md.push(`> [!warning] Sin sesiones en la app\n> ${linesWithoutSessions.map((l) => `\`${l}\``).join(', ')} no tiene sesiones importadas, así que el bloque del viernes (Pilar E) no tiene sesión asignada ni avance. Se importa con \`node scripts/import-study-notes.mjs --apply\`.`);
}
if (startedNotDone.length) {
  md.push('');
  md.push('**Empezadas pero sin marcar como hechas** (tienen pomodoros, siguen pendientes en la app):');
  md.push('');
  for (const s of startedNotDone) md.push(`- ${s.sesion} — ${s.pomodoros} pom., ${hm(s.minutosFoco)}`);
}
if (recentlyDone.length) {
  md.push('');
  md.push('**Últimas terminadas:**');
  md.push('');
  for (const s of recentlyDone) md.push(`- ${s.fecha}: ${s.sesion}`);
}
md.push('');
md.push('## Tiempo de estudio');
md.push('');
md.push(`Últimas ${HISTORY_WEEKS} semanas (lunes a domingo). "Estudio" suma B1, B2, Pilar E y repaso; el foco es aproximado (un tramo cortado cuenta completo).`);
md.push('');
const shownCategories = ['estudio_b1', 'estudio_b2', 'pilar_e', 'repaso', 'investigacion', 'codigo_academico', 'codigo_datos', 'carrera'];
md.push(`| Semana | Plan | ${shownCategories.map(categoryName).join(' | ')} | Estudio | Foco total | Días con estudio | Cortes |`);
md.push(`|---|:-:|${shownCategories.map(() => ':-:').join('|')}|:-:|:-:|:-:|:-:|`);
for (const w of weeks) {
  const planCell = w.semanaDelPlan && w.semanaDelPlan >= 1 ? w.semanaDelPlan : '—';
  const cats = shownCategories.map((c) => w.pomodorosPorCategoria[c] ?? 0).join(' | ');
  md.push(`| ${w.lunes} | ${planCell} | ${cats} | ${w.pomodorosEstudio} pom. · ${hm(w.minutosEstudio)} | ${hm(w.minutosTotales)} | ${w.diasConEstudio} | ${w.cortesDeTramo} |`);
}
md.push('');
md.push('Las columnas por categoría cuentan pomodoros de foco terminados. El foco total incluye bloques sin categoría (los anteriores al horario del 2026-10-19 que no eran de estudio, y los pomodoros sueltos).');
md.push('');
md.push('## Calidad del foco');
md.push('');
md.push(`Últimos ${QUALITY_DAYS} días, de la tarjeta que sale después de cada pomodoro.`);
md.push('');
md.push(`- **Calificación:** ${quality.calificaciones} pomodoros, promedio ${quality.promedio ?? '—'} / 5 (estudio: ${quality.promedioEstudio ?? '—'}). Distribución: ${[1, 2, 3, 4, 5].map((v) => `${v}★ ${distribution[v]}`).join(' · ')}.`);
const tagsText = Object.entries(quality.etiquetas).map(([tag, n]) => `${tag} (${n})`).join(', ');
md.push(`- **Lo que marcaste:** ${tagsText || 'nada todavía'}.`);
md.push(`- **Pomodoros terminados:** ${quality.pomodorosTerminados}. **Cancelados:** ${quality.sesionesCanceladas}. **Bloques saltados:** ${quality.bloquesSaltados}.`);
const reasonsText = Object.entries(exitReasons).map(([r, n]) => `${r} (${n})`).join(', ');
md.push(`- **Salidas del bloque:** ${quality.salidasDelBloque}${reasonsText ? ` — motivos: ${reasonsText}` : ''}. **Cortes de tramo:** ${quality.cortesDeTramo} (si pasan de 2-3 por semana, los tramos de 40 pueden ser largos).`);
if (quality.comentariosRecientes.length) {
  md.push('');
  md.push('**Comentarios recientes:**');
  md.push('');
  for (const r of quality.comentariosRecientes) {
    md.push(`- ${r.fecha} · ${r.calificacion}★${r.sesion ? ` · ${r.sesion}` : r.categoria ? ` · ${categoryName(r.categoria)}` : ''}: "${r.comentario}"`);
  }
}
md.push('');
md.push('## Plan e hitos');
md.push('');
if (plan && phase) {
  md.push(`**${phase.nombre}** (semanas ${phase.semanas[0]}-${phase.semanas[1]}). Contenido de los bloques en esta fase:`);
  md.push('');
  for (const [category, text] of Object.entries(phase.contenido ?? {})) md.push(`- **${categoryName(category)}:** ${text}`);
  md.push('');
}
if (milestoneTasks.length) {
  md.push(`Hitos: ${milestones.hechos} de ${milestones.total} hechos.`);
  md.push('');
  for (const m of milestoneTasks) {
    const flag = !m.hecho && planWeek && m.semana < planWeek ? ' ⚠️ atrasado' : !m.hecho && m.semana === planWeek ? ' ← esta semana' : '';
    md.push(`- [${m.hecho ? 'x' : ' '}] Semana ${m.semana}: ${m.titulo}${m.hecho && m.completadoEl ? ` (hecho el ${m.completadoEl})` : ''}${flag}`);
  }
} else {
  md.push('No hay hitos en la app.');
}
md.push('');
md.push('Los hitos se marcan en la app (Horario); esta lista los copia.');
md.push('');

const markdown = md.join('\n');
if (dryRun) {
  console.log(markdown);
} else {
  writeFileSync(MD_FILE, markdown, 'utf8');
  writeFileSync(JSON_FILE, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
  console.log(`Escrito ${MD_FILE}`);
  console.log(`Escrito ${JSON_FILE}`);
  console.log(`${totalDone}/${totalSessions} sesiones, ${thisWeek.pomodorosEstudio} pomodoros de estudio esta semana, ${quality.calificaciones} calificaciones.`);
}
// No process.exit(): on Windows it can abort with a libuv assertion while fetch keep-alive
// sockets are closing (same as import-study-notes.mjs).
