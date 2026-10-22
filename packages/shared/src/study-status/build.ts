// The study status written into the Obsidian vault ("Notas de Fisica") so the user, Claude or any
// other AI can read how the study plan is going without opening the app (user-requested,
// 2026-10-21): progress per pensum, study time per week, how the pomodoros were rated, the plan's
// week, phase and milestones, the study game per note, and the flexible mornings (2026-10-22). Two
// outputs with the same data: Estado_estudio.md (its "Notas" section is written by hand and kept) and
// estado_estudio.json.
//
// Moved here from scripts/export-study-status.mjs (dynamic-study-blocks D18) so the script and the
// server's StudyStatusService build exactly the same thing. Pure: the callers read the API or the
// database, walk the vault for the catalog, and write the files.

import { replay } from '../study-game/replay.js';
import type { ExerciseAttemptInput } from '../study-game/types.js';
import { xpForLevel } from '../study-game/model.js';
import type { Exercise } from '../notes/exercises.js';
import { PLAN_CATEGORY_INFO } from '../plan/horario.js';
import {
  addDaysToKey,
  localDateKey,
  phaseForWeek,
  planWeekOf,
  planWeekStart,
  weekProgress,
  type PlanScheduleLike,
  type ScheduleExceptionLike,
  type StudyPlanData,
} from '../plan/plan.js';
import { morningStatus } from '../plan/morning.js';
import { STUDY_LINE_MAP, STUDY_LINE_NAMES, studyLineOf } from '../planning/study.js';

export const STUDY_STATUS_MD_FILE = 'Estado_estudio.md';
export const STUDY_STATUS_JSON_FILE = 'estado_estudio.json';
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
export const STUDY_STATUS_QUALITY_DAYS = 28;
/** How far back callers need focus events (the quality section and the mornings). */
export const STUDY_STATUS_EVENTS_DAYS = 120;
const STUDY_CATEGORIES = ['estudio_b1', 'estudio_b2', 'pilar_e', 'repaso'];
const DAY_MS = 24 * 60 * 60 * 1000;

// The rows as the pull returns them (JSON: dates are ISO strings). Only the fields used here.
export interface StudyStatusTask {
  id: string;
  clientId: string | null;
  title: string;
  status: string;
  category?: string | null;
  scheduledAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  deletedAt?: string | null;
}

export interface StudyStatusSession {
  id?: string;
  taskId?: string | null;
  scheduleId?: string | null;
  blockStartAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  createdAt?: string | null;
  completedCycles: number;
  focusDurationMin?: number | null;
  sequence?: Array<{ tipo: string; minutos: number }> | null;
  cutCount?: number | null;
  active?: boolean;
  flexible?: boolean | null;
  focusMinutes?: number | null;
}

export interface StudyStatusFocusEvent {
  id: string;
  kind: string;
  occurredAt: string;
  value?: number | null;
  taskId?: string | null;
  scheduleId?: string | null;
  pomodoroSessionId?: string | null;
  meta?: Record<string, unknown> | null;
}

export interface StudyStatusSnapshot {
  tasks?: StudyStatusTask[];
  schedules?: Array<PlanScheduleLike & { label?: string | null }>;
  scheduleExceptions?: ScheduleExceptionLike[];
  pomodoroSessions?: StudyStatusSession[];
  studyPlan?: { planData: StudyPlanData } | null;
  exerciseAttempts?: ExerciseAttemptInput[];
}

export interface StudyStatusInput {
  snapshot: StudyStatusSnapshot;
  focusEvents: StudyStatusFocusEvent[];
  /** Every exercise of the vault's notes (parseExercises over each note). */
  catalog: Exercise[];
  /** Note code -> its file name without .md, for links. */
  noteFiles: Map<string, string>;
  now: Date;
  /** The current Estado_estudio.md, to keep its "Notas" section. */
  previousMarkdown: string | null;
  /** Said in the file: how it was regenerated. */
  source?: 'script' | 'server';
}

export interface StudyStatus {
  markdown: string;
  /** estado_estudio.json's object. */
  json: Record<string, unknown>;
  summary: {
    sessionsDone: number;
    sessionsTotal: number;
    studyPomodorosThisWeek: number;
    ratings: number;
  };
}

/** The hand-written "Notas" section of a previous Estado_estudio.md, or the default prompts. */
export function manualNotesOf(previousMarkdown: string | null): string {
  if (!previousMarkdown) return DEFAULT_NOTES;
  const start = previousMarkdown.indexOf(NOTES_START);
  const end = previousMarkdown.indexOf(NOTES_END);
  return start >= 0 && end > start
    ? previousMarkdown.slice(start + NOTES_START.length, end).trim()
    : DEFAULT_NOTES;
}

export function buildStudyStatus(input: StudyStatusInput): StudyStatus {
  const { snapshot, focusEvents, catalog, noteFiles, now } = input;
  const today = localDateKey(now);
  const tasks = (snapshot.tasks ?? []).filter((t) => !t.deletedAt);
  const schedules = snapshot.schedules ?? [];
  const exceptions = snapshot.scheduleExceptions ?? [];
  const sessions = snapshot.pomodoroSessions ?? [];
  const plan = snapshot.studyPlan?.planData ?? null;

  const pct = (done: number, total: number) => (total ? Math.round((100 * done) / total) : 0);
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const mondayOf = (key: string) =>
    addDaysToKey(key, -((new Date(`${key}T12:00:00`).getDay() + 6) % 7));
  const categoryName = (c: string) =>
    PLAN_CATEGORY_INFO[c as keyof typeof PLAN_CATEGORY_INFO]?.name ?? c;
  const sessionDate = (s: StudyStatusSession) => {
    const when = s.blockStartAt ?? s.startedAt ?? s.createdAt;
    return when ? localDateKey(new Date(when)) : null;
  };
  const LABEL_CATEGORIES: Array<[string, string]> = [
    ['Estudio B1', 'estudio_b1'],
    ['Estudio B2', 'estudio_b2'],
    ['Pilar E', 'pilar_e'],
  ];
  const BLOCK_CATEGORY: Record<string, string> = {
    'Estudio B1': 'estudio_b1',
    'Estudio B2': 'estudio_b2',
  };
  /**
   * The plan category of a pomodoro: the block's that day (an exception wins). Blocks from before the
   * timetable (2026-10-19) have no category, so their label decides, and failing that, the study
   * session the pomodoro was on.
   */
  function categoryOf(
    scheduleId: string | null | undefined,
    dateKey: string | null,
    taskId: string | null | undefined,
  ): string | null {
    const exception = scheduleId
      ? exceptions.find(
          (e) => e.scheduleId === scheduleId && e.date?.slice(0, 10) === dateKey && !e.deletedAt,
        )
      : null;
    const schedule = scheduleId ? schedules.find((s) => s.id === scheduleId) : null;
    const fromLabel = LABEL_CATEGORIES.find(([text]) => schedule?.label?.includes(text))?.[1];
    const task = taskId ? tasks.find((t) => t.id === taskId) : null;
    const line = task ? studyLineOf(task) : null;
    const block = line
      ? STUDY_LINE_MAP.find((e) => e.lines.includes(line))?.titleContains
      : undefined;
    const fromTask = block ? BLOCK_CATEGORY[block] : null;
    return exception?.category ?? schedule?.category ?? fromLabel ?? fromTask ?? null;
  }
  const sessionCategory = (s: StudyStatusSession) =>
    categoryOf(s.scheduleId, sessionDate(s), s.taskId);
  /**
   * Focus minutes of a session: a flexible block's real minutes (2026-10-22), else its finished focus
   * segments (sequence) or cycles x focus length.
   */
  function focusMinutes(session: StudyStatusSession): number {
    if (session.flexible) return session.focusMinutes ?? 0;
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
  const phase = plan && planWeek !== null && planWeek >= 1 ? phaseForWeek(plan, planWeek) : null;
  const milestoneTasks = tasks
    .filter((t) => t.clientId?.startsWith('hito:'))
    .map((t) => ({
      semana: Number(t.clientId!.split(':')[1]),
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
    proximos: planWeek
      ? milestoneTasks.filter((m) => !m.hecho && m.semana > planWeek && m.semana <= planWeek + 2)
      : [],
    todos: milestoneTasks,
  };

  // ─── Progress per pensum ───────────────────────────────────────────────────

  const studyTasks = tasks.filter((t) => studyLineOf(t));
  const pomodorosByTask = new Map<string, number>();
  const minutesByTask = new Map<string, number>();
  for (const s of sessions) {
    if (!s.taskId) continue;
    pomodorosByTask.set(s.taskId, (pomodorosByTask.get(s.taskId) ?? 0) + (s.completedCycles ?? 0));
    minutesByTask.set(s.taskId, (minutesByTask.get(s.taskId) ?? 0) + focusMinutes(s));
  }
  const inOrder = (list: StudyStatusTask[]) =>
    [...list].sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) ||
        (a.clientId ?? '').localeCompare(b.clientId ?? ''),
    );
  const isPending = (t: StudyStatusTask) => t.status === 'PENDING' || t.status === 'IN_PROGRESS';
  const blockOfLine = (line: string) =>
    STUDY_LINE_MAP.find((e) => e.lines.includes(line))?.titleContains ?? null;

  // Every pensum that has imported sessions, in the map's order first and then the rest.
  const mappedLines = STUDY_LINE_MAP.flatMap((e) => e.lines);
  const allLines = [...new Set([...mappedLines, ...studyTasks.map((t) => studyLineOf(t)!)])];
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
      pomodorosEnLaSiguiente: next ? (pomodorosByTask.get(next.id) ?? 0) : 0,
      pomodoros: own.reduce((sum, t) => sum + (pomodorosByTask.get(t.id) ?? 0), 0),
      minutosFoco: own.reduce((sum, t) => sum + (minutesByTask.get(t.id) ?? 0), 0),
    };
  });
  // Sessions with pomodoros on them that aren't marked done: the likely gap between the app and reality.
  const startedNotDone = inOrder(
    studyTasks.filter((t) => isPending(t) && (pomodorosByTask.get(t.id) ?? 0) > 0),
  ).map((t) => ({
    sesion: t.title,
    pensum: studyLineOf(t),
    pomodoros: pomodorosByTask.get(t.id) ?? 0,
    minutosFoco: minutesByTask.get(t.id) ?? 0,
  }));
  const recentlyDone = studyTasks
    .filter((t) => t.status === 'COMPLETED' && t.completedAt)
    .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!))
    .slice(0, 8)
    .map((t) => ({ sesion: t.title, fecha: localDateKey(new Date(t.completedAt!)) }));
  // The study lines with a block in the plan but no imported sessions (the Pilar E pensum, for now).
  const linesWithoutSessions = ['pensum_pilar_E.md'].filter(
    (line) => !studyTasks.some((t) => studyLineOf(t) === line),
  );

  // ─── Study time ────────────────────────────────────────────────────────────

  const thisMonday = mondayOf(today);
  const weeks = Array.from({ length: HISTORY_WEEKS }, (_, i) =>
    addDaysToKey(thisMonday, -7 * (HISTORY_WEEKS - 1 - i)),
  ).map((weekStart) => {
    const weekEnd = addDaysToKey(weekStart, 7);
    const own = sessions.filter((s) => {
      const d = sessionDate(s);
      return d && d >= weekStart && d < weekEnd;
    });
    // weekProgress gives the cuts; the categories are counted here, with the fallback for old blocks.
    const progress = weekProgress(sessions, schedules, exceptions, weekStart);
    const pomodorosByCategory: Record<string, number> = {};
    const minutesByCategory: Record<string, number> = {};
    for (const s of own) {
      const category = sessionCategory(s) ?? 'sin_categoria';
      pomodorosByCategory[category] =
        (pomodorosByCategory[category] ?? 0) + (s.completedCycles ?? 0);
      minutesByCategory[category] = (minutesByCategory[category] ?? 0) + focusMinutes(s);
    }
    const studyPomodoros = STUDY_CATEGORIES.reduce(
      (sum, c) => sum + (pomodorosByCategory[c] ?? 0),
      0,
    );
    const studyMinutes = STUDY_CATEGORIES.reduce((sum, c) => sum + (minutesByCategory[c] ?? 0), 0);
    // Flexible mornings (2026-10-22): fulfilled with two blocks of 60+ min of real focus.
    const days = Array.from({ length: 7 }, (_, i) => addDaysToKey(weekStart, i)).filter(
      (d) => d <= today,
    );
    const mornings = days.map((d) => morningStatus(sessions, d)).filter((m) => m.started > 0);
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
        own
          .filter(
            (s) =>
              (s.completedCycles ?? 0) > 0 && STUDY_CATEGORIES.includes(sessionCategory(s) ?? ''),
          )
          .map(sessionDate),
      ).size,
      mananasCumplidas: mornings.filter((m) => m.fulfilled).length,
      mananasConBloques: mornings.length,
      bloquesCumplidos: mornings.reduce((sum, m) => sum + m.done, 0),
    };
  });

  // Streak: consecutive days, up to today (or yesterday if today has nothing yet), with a finished
  // study pomodoro. Sundays don't break it (the plan has them free).
  const studyDays = new Set(
    sessions
      .filter(
        (s) => (s.completedCycles ?? 0) > 0 && STUDY_CATEGORIES.includes(sessionCategory(s) ?? ''),
      )
      .map(sessionDate),
  );
  let streak = 0;
  for (
    let day = studyDays.has(today) ? today : addDaysToKey(today, -1);
    ;
    day = addDaysToKey(day, -1)
  ) {
    if (studyDays.has(day)) streak += 1;
    else if (new Date(`${day}T12:00:00`).getDay() !== 0) break;
    if (streak > 365) break;
  }
  const lastStudyDay =
    [...studyDays]
      .filter((d): d is string => !!d)
      .sort()
      .at(-1) ?? null;

  // ─── Mornings (dynamic-study-blocks, 2026-10-22) ─────────────────────────────

  const todayMorning = morningStatus(sessions, today);
  const recentMornings = Array.from({ length: 14 }, (_, i) => addDaysToKey(today, -i))
    .map((date) => ({ date, status: morningStatus(sessions, date) }))
    .filter((m) => m.status.started > 0)
    .map((m) => ({
      fecha: m.date,
      bloques: m.status.started,
      cumplidos: m.status.done,
      cumplida: m.status.fulfilled,
      minutosFoco: m.status.blocks.map((b) => b.focusMinutes),
    }));
  // The check-ins at block start, for calibrating the energy table later (D8).
  const checkIns = focusEvents
    .filter((e) => e.kind === 'CHECK_IN' && e.meta?.scope === 'block-start')
    .slice(-10)
    .map((e) => ({
      fecha: localDateKey(new Date(e.occurredAt)),
      motivacion: e.meta?.motivation ?? null,
      concentracion: e.meta?.concentration ?? null,
      energia: e.meta?.energy ?? null,
      propuesto: e.meta?.proposed ?? null,
      elegido: e.meta?.chosen ?? null,
    }));

  // ─── Focus quality ─────────────────────────────────────────────────────────

  const qualitySince = new Date(now.getTime() - STUDY_STATUS_QUALITY_DAYS * DAY_MS);
  const recentEvents = focusEvents.filter((e) => new Date(e.occurredAt) >= qualitySince);
  // One rating per pomodoro: a card answered twice (seen 2026-10-07, a double tap) counts once.
  const reviewsByKey = new Map<string, StudyStatusFocusEvent>();
  for (const e of recentEvents) {
    if (e.kind !== 'CHECK_IN' || !e.meta?.review) continue;
    reviewsByKey.set(`${e.pomodoroSessionId ?? e.id}#${e.meta.cycle ?? ''}`, e);
  }
  const reviews = [...reviewsByKey.values()].map((e) => {
    const date = localDateKey(new Date(e.occurredAt));
    const task = e.taskId ? tasks.find((t) => t.id === e.taskId) : null;
    const meta = e.meta ?? {};
    return {
      fecha: date,
      calificacion: (meta.rating as number | undefined) ?? e.value ?? 0,
      categoria: categoryOf(e.scheduleId, date, e.taskId),
      sesion: task?.title ?? null,
      etiquetas: (meta.tags as string[] | undefined) ?? [],
      comentario: (meta.comment as string | undefined) ?? null,
      sesionTerminada: (meta.sessionDone as boolean | undefined) ?? null,
    };
  });
  type Review = (typeof reviews)[number];
  const average = (list: Review[]) =>
    list.length ? round1(list.reduce((s, r) => s + r.calificacion, 0) / list.length) : null;
  const distribution = Object.fromEntries(
    [1, 2, 3, 4, 5].map((v) => [v, reviews.filter((r) => r.calificacion === v).length]),
  ) as Record<number, number>;
  const tagCounts: Record<string, number> = {};
  for (const r of reviews)
    for (const tag of r.etiquetas) tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
  const countKind = (kind: string) => recentEvents.filter((e) => e.kind === kind).length;
  const exitReasons: Record<string, number> = {};
  for (const e of recentEvents) {
    const reason = e.meta?.reason as string | undefined;
    if (e.kind !== 'BLOCK_EXIT_REASON' || !reason) continue;
    exitReasons[reason] = (exitReasons[reason] ?? 0) + 1;
  }
  const quality = {
    dias: STUDY_STATUS_QUALITY_DAYS,
    calificaciones: reviews.length,
    promedio: average(reviews),
    promedioEstudio: average(reviews.filter((r) => STUDY_CATEGORIES.includes(r.categoria ?? ''))),
    distribucion: distribution,
    etiquetas: Object.fromEntries(Object.entries(tagCounts).sort((a, b) => b[1] - a[1])),
    comentariosRecientes: reviews
      .filter((r) => r.comentario)
      .slice(-6)
      .reverse(),
    cortesDeTramo: countKind('SEGMENT_CUT'),
    salidasDelBloque: countKind('BLOCK_EXITED'),
    motivosDeSalida: exitReasons,
    bloquesSaltados: countKind('BLOCK_SKIPPED'),
    sesionesCanceladas: countKind('SESSION_CANCELLED'),
    pomodorosTerminados: countKind('FOCUS_COMPLETED'),
  };

  // ─── Study game ────────────────────────────────────────────────────────────
  // Replayed from every attempt in the pull (the game state is never stored, study-tutor-game D6)
  // against the catalog parsed from the vault's notes as they are now (D25).

  const game = replay(snapshot.exerciseAttempts ?? [], catalog);
  const round2 = (n: number | null | undefined) =>
    n === null || n === undefined ? null : Math.round(n * 100) / 100;
  const gameNotes = [...new Set(Object.values(game.sections).map((s) => s.noteCode))]
    .sort()
    .map((noteCode) => {
      const inNote = catalog.filter((e) => e.noteCode === noteCode);
      const note = game.notes[noteCode];
      return {
        nota: noteCode,
        archivo: noteFiles.get(noteCode) ?? null,
        ejerciciosEnLaNota: inNote.length,
        intentados: inNote.filter((e) => game.exercises[e.id]).length,
        resueltos: inNote.filter((e) => game.exercises[e.id]?.solved).length,
        thetaMedio: round2(note?.meanTheta),
        secciones: Object.values(game.sections)
          .filter((s) => s.noteCode === noteCode)
          .map((s) => ({
            seccion: s.section,
            theta: round2(s.theta),
            nivel: s.level,
            intentos: s.attempts,
          })),
        jefes: (note?.bosses ?? []).map((b) => ({
          id: b.exerciseId,
          tipo: b.kind === 'dificil' ? '🔴' : '⚫',
          desbloqueado: b.unlocked,
          vencido: b.beaten,
        })),
        cerrada: note?.closed ?? false,
      };
    });
  const gameStatus = {
    intentos: game.outcomes.length,
    xp: game.xp,
    nivel: game.level,
    xpParaElSiguienteNivel: Math.ceil(xpForLevel(game.level + 1)),
    combo: game.combo.streak,
    catalogo: { ejercicios: catalog.length, notas: noteFiles.size },
    notas: gameNotes,
    repaso: game.review.map((r) => ({
      ejercicio: r.exerciseId,
      nota: r.noteCode,
      seccion: r.section,
      desde: r.since,
    })),
  };

  // ─── Output ────────────────────────────────────────────────────────────────

  const totalDone = lines.reduce((s, l) => s + l.hechas, 0);
  const totalSessions = lines.reduce((s, l) => s + l.total, 0);
  const thisWeek = weeks.at(-1)!;
  const manualNotes = manualNotesOf(input.previousMarkdown);
  const howTo =
    input.source === 'server'
      ? 'lo regenera solo el servidor de la app unos segundos después de cada cambio de estudio; a mano: node scripts/export-study-status.mjs (en Proyectos/calendar, con la API corriendo)'
      : 'node scripts/export-study-status.mjs (en Proyectos/calendar, con la API corriendo); el servidor de la app también lo regenera solo';

  const json = {
    version: 3,
    generadoEl: now.toISOString(),
    comoRegenerar: howTo,
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
      mananasCumplidasEstaSemana: thisWeek.mananasCumplidas,
    },
    mananas: {
      hoy: {
        bloques: todayMorning.started,
        cumplidos: todayMorning.done,
        meta: todayMorning.target,
        cumplida: todayMorning.fulfilled,
      },
      ultimas: recentMornings,
      checkIns,
    },
    avancePorPensum: lines,
    pensumsSinSesiones: linesWithoutSessions,
    sesionesEmpezadasSinMarcar: startedNotDone,
    ultimasSesionesTerminadas: recentlyDone,
    tiempoPorSemana: weeks,
    calidadDelFoco: quality,
    hitos: milestones,
    juego: gameStatus,
    notasManuales: manualNotes,
  };

  const hm = (minutes: number) =>
    minutes >= 60
      ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`
      : `${minutes} min`;
  const cell = (s: unknown) => String(s ?? '—').replace(/\|/g, '\\|');
  const md: string[] = [];
  md.push('# Estado del estudio');
  md.push('');
  md.push(
    `Volver a [[00_Intro]] · Plan en [[Horario]]. Generado el ${today} a las ${now.toTimeString().slice(0, 5)} desde la app de calendario.`,
  );
  md.push('');
  md.push('> [!info] Cómo usar este archivo');
  md.push(
    '> El servidor de la app lo regenera solo unos segundos después de cada cambio de estudio (también a mano: `node scripts/export-study-status.mjs` en `Proyectos/calendar`, con la API corriendo), salvo la sección **Notas**, que se escribe a mano y se conserva. Los mismos datos están en `estado_estudio.json`. Una sesión cuenta como hecha solo cuando se marca en la app (la tarjeta del final del bloque). Si los datos parecen viejos, mira la fecha de arriba: quizá la API no está corriendo.',
  );
  md.push('');
  md.push('## Resumen');
  md.push('');
  if (plan) {
    md.push(
      `- **Plan:** semana ${planWeek} de ${plan.weeks ?? 14} (empezó el ${plan.startDate}). ${phase ? `**${phase.nombre}**.` : planWeek! < 1 ? 'Todavía no empieza.' : 'Ya terminó.'}`,
    );
  } else {
    md.push('- **Plan:** no hay horario cargado en la app.');
  }
  md.push(
    `- **Sesiones de pensum:** ${totalDone} de ${totalSessions} (${pct(totalDone, totalSessions)} %).`,
  );
  md.push(
    `- **Esta semana:** ${thisWeek.pomodorosEstudio} pomodoros de estudio (${hm(thisWeek.minutosEstudio)}), ${thisWeek.diasConEstudio} días con estudio.`,
  );
  md.push(
    `- **Mañanas:** hoy ${todayMorning.done} de ${todayMorning.target} bloques cumplidos${todayMorning.fulfilled ? ' (mañana cumplida)' : ''}; esta semana ${thisWeek.mananasCumplidas} ${thisWeek.mananasCumplidas === 1 ? 'mañana cumplida' : 'mañanas cumplidas'}. Un bloque se cumple con 60 min de foco real.`,
  );
  md.push(
    `- **Racha:** ${streak} ${streak === 1 ? 'día' : 'días'} seguidos con estudio${lastStudyDay ? ` (último: ${lastStudyDay})` : ''}. Los domingos no la cortan.`,
  );
  md.push(
    `- **Foco (últimos ${STUDY_STATUS_QUALITY_DAYS} días):** ${quality.calificaciones} pomodoros calificados, promedio ${quality.promedio ?? '—'} / 5.`,
  );
  md.push(
    gameStatus.intentos
      ? `- **Juego:** nivel ${gameStatus.nivel}, ${gameStatus.xp} XP, ${gameStatus.intentos} intentos, ${gameStatus.repaso.length} en repaso.`
      : '- **Juego:** todavía no hay ejercicios intentados.',
  );
  if (milestones.atrasados.length)
    md.push(`- **Hitos atrasados:** ${milestones.atrasados.length}.`);
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
    const current = l.siguiente
      ? `${l.siguiente}${l.pomodorosEnLaSiguiente ? ` (${l.pomodorosEnLaSiguiente} pom.)` : ''}`
      : l.total
        ? '✓ terminado'
        : '—';
    md.push(
      `| ${cell(l.nombre)} | ${cell(l.bloque)} | ${l.hechas}/${l.total} | ${l.porcentaje} | ${l.pomodoros} | ${hm(l.minutosFoco)} | ${cell(current)} |`,
    );
  }
  md.push('');
  md.push(
    'Cada bloque toma las sesiones de sus pensums en orden y termina uno antes de pasar al siguiente: la "sesión actual" es la que le toca al próximo bloque de esa línea.',
  );
  if (linesWithoutSessions.length) {
    md.push('');
    md.push(
      `> [!warning] Sin sesiones en la app\n> ${linesWithoutSessions.map((l) => `\`${l}\``).join(', ')} no tiene sesiones importadas, así que el bloque del viernes (Pilar E) no tiene sesión asignada ni avance. Se importa con \`node scripts/import-study-notes.mjs --apply\`.`,
    );
  }
  if (startedNotDone.length) {
    md.push('');
    md.push(
      '**Empezadas pero sin marcar como hechas** (tienen pomodoros, siguen pendientes en la app):',
    );
    md.push('');
    for (const s of startedNotDone)
      md.push(`- ${s.sesion} — ${s.pomodoros} pom., ${hm(s.minutosFoco)}`);
  }
  if (recentlyDone.length) {
    md.push('');
    md.push('**Últimas terminadas:**');
    md.push('');
    for (const s of recentlyDone) md.push(`- ${s.fecha}: ${s.sesion}`);
  }
  md.push('');
  md.push('## Mañanas de estudio');
  md.push('');
  md.push(
    'Desde el 2026-10-22 la mañana es una ventana de 08:00 a 12:00 para dos bloques que empiezan cuando los inicias. Un bloque se cumple con al menos 60 min de foco real; la mañana, con dos bloques cumplidos.',
  );
  md.push('');
  if (recentMornings.length) {
    md.push('| Día | Bloques | Cumplidos | Foco por bloque | Mañana |');
    md.push('|---|:-:|:-:|---|:-:|');
    for (const m of recentMornings) {
      md.push(
        `| ${m.fecha} | ${m.bloques} | ${m.cumplidos} | ${m.minutosFoco.map((n) => hm(n)).join(' · ')} | ${m.cumplida ? '✅' : '—'} |`,
      );
    }
  } else {
    md.push('Todavía no hay bloques de la mañana con el horario nuevo.');
  }
  if (checkIns.length) {
    md.push('');
    md.push(
      '**Check-ins al empezar** (motivación/concentración → propuesto → elegido, en min de bloque/foco):',
    );
    md.push('');
    const pair = (p: unknown) => {
      const v = p as { blockMin?: number; focusMin?: number } | null;
      return v ? `${v.blockMin}/${v.focusMin}` : '—';
    };
    for (const c of checkIns)
      md.push(
        `- ${c.fecha}: ${c.motivacion}/${c.concentracion} (E ${c.energia}) → ${pair(c.propuesto)} → ${pair(c.elegido)}`,
      );
  }
  md.push('');
  md.push('## Tiempo de estudio');
  md.push('');
  md.push(
    `Últimas ${HISTORY_WEEKS} semanas (lunes a domingo). "Estudio" suma B1, B2, Pilar E y repaso; el foco es aproximado (un tramo cortado cuenta completo, salvo en los bloques de la mañana, que cuentan los minutos reales).`,
  );
  md.push('');
  const shownCategories = [
    'estudio_b1',
    'estudio_b2',
    'pilar_e',
    'repaso',
    'investigacion',
    'codigo_academico',
    'codigo_datos',
    'carrera',
  ];
  md.push(
    `| Semana | Plan | ${shownCategories.map(categoryName).join(' | ')} | Estudio | Foco total | Días con estudio | Cortes |`,
  );
  md.push(`|---|:-:|${shownCategories.map(() => ':-:').join('|')}|:-:|:-:|:-:|:-:|`);
  for (const w of weeks) {
    const planCell = w.semanaDelPlan && w.semanaDelPlan >= 1 ? w.semanaDelPlan : '—';
    const cats = shownCategories.map((c) => w.pomodorosPorCategoria[c] ?? 0).join(' | ');
    md.push(
      `| ${w.lunes} | ${planCell} | ${cats} | ${w.pomodorosEstudio} pom. · ${hm(w.minutosEstudio)} | ${hm(w.minutosTotales)} | ${w.diasConEstudio} | ${w.cortesDeTramo} |`,
    );
  }
  md.push('');
  md.push(
    'Las columnas por categoría cuentan pomodoros de foco terminados. El foco total incluye bloques sin categoría (los anteriores al horario del 2026-10-19 que no eran de estudio, y los pomodoros sueltos).',
  );
  md.push('');
  md.push('## Calidad del foco');
  md.push('');
  md.push(
    `Últimos ${STUDY_STATUS_QUALITY_DAYS} días, de la tarjeta que sale después de cada pomodoro.`,
  );
  md.push('');
  md.push(
    `- **Calificación:** ${quality.calificaciones} pomodoros, promedio ${quality.promedio ?? '—'} / 5 (estudio: ${quality.promedioEstudio ?? '—'}). Distribución: ${[1, 2, 3, 4, 5].map((v) => `${v}★ ${distribution[v]}`).join(' · ')}.`,
  );
  const tagsText = Object.entries(quality.etiquetas)
    .map(([tag, n]) => `${tag} (${n})`)
    .join(', ');
  md.push(`- **Lo que marcaste:** ${tagsText || 'nada todavía'}.`);
  md.push(
    `- **Pomodoros terminados:** ${quality.pomodorosTerminados}. **Cancelados:** ${quality.sesionesCanceladas}. **Bloques saltados:** ${quality.bloquesSaltados}.`,
  );
  const reasonsText = Object.entries(exitReasons)
    .map(([r, n]) => `${r} (${n})`)
    .join(', ');
  md.push(
    `- **Salidas del bloque:** ${quality.salidasDelBloque}${reasonsText ? ` — motivos: ${reasonsText}` : ''}. **Cortes de tramo:** ${quality.cortesDeTramo} (si pasan de 2-3 por semana, los focos pueden ser largos).`,
  );
  if (quality.comentariosRecientes.length) {
    md.push('');
    md.push('**Comentarios recientes:**');
    md.push('');
    for (const r of quality.comentariosRecientes) {
      md.push(
        `- ${r.fecha} · ${r.calificacion}★${r.sesion ? ` · ${r.sesion}` : r.categoria ? ` · ${categoryName(r.categoria)}` : ''}: "${r.comentario}"`,
      );
    }
  }
  md.push('');
  md.push('## Juego de ejercicios');
  md.push('');
  if (!gameStatus.intentos) {
    md.push(
      `Todavía no hay ejercicios intentados. El catálogo tiene ${catalog.length} ejercicios en ${noteFiles.size} notas; el tutor los propone durante los bloques de estudio.`,
    );
  } else {
    md.push(
      `**Nivel ${gameStatus.nivel}** · ${gameStatus.xp} XP (el siguiente nivel pide ${gameStatus.xpParaElSiguienteNivel}) · ${gameStatus.intentos} intentos · combo actual ${gameStatus.combo}.`,
    );
    md.push('');
    md.push(
      '| Nota | Intentados | Resueltos | θ medio | Secciones (θ · nivel · intentos) | Jefes |',
    );
    md.push('|---|:-:|:-:|:-:|---|---|');
    for (const n of gameNotes) {
      const link = n.archivo ? `[[${n.archivo}\\|${n.nota}]]` : n.nota;
      const sections = n.secciones
        .map((s) => `§${s.seccion}: ${s.theta} · N${s.nivel} · ${s.intentos}`)
        .join('<br>');
      const bosses = n.jefes
        .map(
          (b) =>
            `${b.tipo} ${b.id.split('#').pop()} ${b.vencido ? '✅' : b.desbloqueado ? '🔓' : '🔒'}`,
        )
        .join(' ');
      md.push(
        `| ${link}${n.cerrada ? ' ✅' : ''} | ${n.intentados}/${n.ejerciciosEnLaNota} | ${n.resueltos} | ${n.thetaMedio ?? '—'} | ${sections} | ${bosses || '—'} |`,
      );
    }
    md.push('');
    md.push(
      'θ es la habilidad estimada en escala logit: con θ = 0 un 🟡 sale la mitad de las veces. Nivel de sección: N2 desde θ −1, N3 desde 0, N4 desde 1, N5 desde 2. Jefes: ✅ vencido, 🔓 desbloqueado, 🔒 bloqueado.',
    );
    if (gameStatus.repaso.length) {
      md.push('');
      md.push('**Cola de repaso** (fallados, para el sábado):');
      md.push('');
      for (const r of gameStatus.repaso)
        md.push(`- \`${r.ejercicio}\` desde ${r.desde.slice(0, 10)}`);
    }
  }
  md.push('');
  md.push('## Plan e hitos');
  md.push('');
  if (plan && phase) {
    md.push(
      `**${phase.nombre}** (semanas ${phase.semanas[0]}-${phase.semanas[1]}). Contenido de los bloques en esta fase:`,
    );
    md.push('');
    for (const [category, text] of Object.entries(phase.contenido ?? {}))
      md.push(`- **${categoryName(category)}:** ${text}`);
    md.push('');
  }
  if (milestoneTasks.length) {
    md.push(`Hitos: ${milestones.hechos} de ${milestones.total} hechos.`);
    md.push('');
    for (const m of milestoneTasks) {
      const flag =
        !m.hecho && planWeek && m.semana < planWeek
          ? ' ⚠️ atrasado'
          : !m.hecho && m.semana === planWeek
            ? ' ← esta semana'
            : '';
      md.push(
        `- [${m.hecho ? 'x' : ' '}] Semana ${m.semana}: ${m.titulo}${m.hecho && m.completadoEl ? ` (hecho el ${m.completadoEl})` : ''}${flag}`,
      );
    }
  } else {
    md.push('No hay hitos en la app.');
  }
  md.push('');
  md.push('Los hitos se marcan en la app (Horario); esta lista los copia.');
  md.push('');

  return {
    markdown: md.join('\n'),
    json,
    summary: {
      sessionsDone: totalDone,
      sessionsTotal: totalSessions,
      studyPomodorosThisWeek: thisWeek.pomodorosEstudio,
      ratings: quality.calificaciones,
    },
  };
}
