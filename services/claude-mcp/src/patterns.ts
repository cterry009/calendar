import { dayKey, localHour, weekday, type Snapshot } from './data.js';

// 2026-11-10: how Cristo actually works, read from the calendar (not from chat): when he focuses,
// which blocks he keeps or skips, how long his sessions run, how tasks and game time go. The organizing
// assistant uses it to time and size what it proposes. Read-only, last N days.

const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function patterns(snap: Snapshot, days = 28) {
  const since = Date.now() - days * 86_400_000;
  const inRange = (iso: string | null | undefined) => !!iso && Date.parse(iso) >= since;

  // Focus by hour and weekday (completed cycles x focus minutes).
  const byHour = new Array<number>(24).fill(0);
  const byDay = new Array<number>(7).fill(0);
  const sessions = (snap.pomodoroSessions ?? []).filter((s) => inRange(s.startedAt));
  let focusMin = 0;
  let interrupted = 0;
  const lengths: number[] = [];
  for (const s of sessions) {
    const m = s.completedCycles * s.focusDurationMin;
    focusMin += m;
    if (s.interrupted) interrupted += 1;
    if (m > 0) lengths.push(m);
    byHour[localHour(s.startedAt!)] += m;
    byDay[weekday(new Date(s.startedAt!))] += m;
  }
  const bestHours = byHour
    .map((m, h) => ({ h, m }))
    .filter((x) => x.m > 0)
    .sort((a, b) => b.m - a.m)
    .slice(0, 3)
    .map((x) => `${x.h}:00 (${x.m} min)`);
  lengths.sort((a, b) => a - b);
  const median = lengths.length ? lengths[Math.floor(lengths.length / 2)] : null;

  // Work blocks kept vs skipped, by category.
  const schedules = new Map(snap.schedules.map((s) => [s.id, s]));
  const blocks: Record<string, { hechos: number; saltados: number; razones: string[] }> = {};
  for (const c of snap.scheduleCompletions ?? []) {
    if (Date.parse(`${c.date.slice(0, 10)}T12:00:00Z`) < since) continue;
    const s = schedules.get(c.scheduleId);
    const cat = s?.category ?? s?.label ?? 'sin categoría';
    const b = (blocks[cat] ??= { hechos: 0, saltados: 0, razones: [] });
    if (c.status === 'SKIPPED') {
      b.saltados += 1;
      if (c.reason) b.razones.push(c.reason);
    } else b.hechos += 1;
  }
  // A block with focus that day counts as done too (blocks are rarely ticked by hand).
  const markedKeys = new Set((snap.scheduleCompletions ?? []).map((c) => `${c.scheduleId}|${c.date.slice(0, 10)}`));
  for (const ses of sessions) {
    if (!ses.scheduleId || ses.completedCycles === 0) continue;
    const k = `${ses.scheduleId}|${dayKey(new Date(ses.startedAt!))}`;
    if (markedKeys.has(k)) continue;
    markedKeys.add(k);
    const sc = schedules.get(ses.scheduleId);
    const cat = sc?.category ?? sc?.label ?? 'sin categoría';
    (blocks[cat] ??= { hechos: 0, saltados: 0, razones: [] }).hechos += 1;
  }
  // Expected work blocks in the range, to see the ones neither done nor skipped.
  let expected = 0;
  for (let i = 0; i < days; i++) {
    const wd = weekday(new Date(Date.now() - i * 86_400_000));
    expected += snap.schedules.filter((s) => s.enabled && s.kind === 'WORK' && s.daysOfWeek.includes(wd)).length;
  }
  const marked = Object.values(blocks).reduce((a, b) => a + b.hechos + b.saltados, 0);

  // Tasks.
  const tasks = snap.tasks.filter((t) => !t.deletedAt);
  const completed = tasks.filter((t) => inRange(t.completedAt)).length;
  const today = dayKey();
  const overdue = tasks.filter((t) => t.status !== 'COMPLETED' && t.scheduledAt && dayKey(new Date(t.scheduledAt)) < today).length;

  // Tutor and games.
  const attempts = (snap.exerciseAttempts ?? []).filter((a) => inRange(a.occurredAt));
  const tutorHours = new Array<number>(24).fill(0);
  for (const a of attempts) tutorHours[localHour(a.occurredAt)] += 1;
  const games = (snap.dailyGameTime ?? []).filter((g) => Date.parse(`${g.date.slice(0, 10)}T12:00:00Z`) >= since);
  const gameAvg = games.length ? Math.round(games.reduce((a, g) => a + g.totalMinutes, 0) / days) : 0;

  // Check-ins: energy by hour, naps per day, and energy on days after a very intense session.
  const checks = (snap.checkIns ?? []).filter((c) => inRange(c.at));
  const energyByHour: Record<string, number[]> = {};
  for (const c of checks) if (c.energy !== null) (energyByHour[`${localHour(c.at)}:00`] ??= []).push(c.energy);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const naps = new Map<string, number>();
  for (const c of checks) if (c.napped) naps.set(dayKey(new Date(c.at)), (naps.get(dayKey(new Date(c.at))) ?? 0) + 1);
  const intenseDays = new Set(checks.filter((c) => c.exerciseIntensity === 'muy-intenso').map((c) => dayKey(new Date(c.at))));
  const energyOn = (pred: (d: string) => boolean) =>
    avg(checks.filter((c) => c.energy !== null && localHour(c.at) >= 12 && pred(dayKey(new Date(c.at)))).map((c) => c.energy as number));
  const reasons: Record<string, number> = {};
  for (const c of checks) if (c.kind === 'dinamico' && c.reason) reasons[c.reason] = (reasons[c.reason] ?? 0) + 1;

  return {
    periodo_dias: days,
    registros: {
      cantidad: checks.length,
      energia_promedio_por_hora: Object.fromEntries(Object.entries(energyByHour).map(([h, xs]) => [h, avg(xs)])),
      siestas_por_dia: Object.fromEntries(naps),
      energia_tarde_dias_muy_intensos: energyOn((d) => intenseDays.has(d)),
      energia_tarde_otros_dias: energyOn((d) => !intenseDays.has(d)),
      motivos_dinamicos: reasons,
      avance_promedio_reportado: avg(checks.filter((c) => c.progress !== null).map((c) => c.progress as number)),
    },
    foco: {
      minutos_totales: focusMin,
      sesiones: sessions.length,
      interrumpidas: interrupted,
      duracion_mediana_min: median,
      mejores_horas: bestHours,
      por_dia_semana: Object.fromEntries(DAYS.map((d, i) => [d, byDay[i]])),
    },
    bloques: {
      esperados: expected,
      marcados: marked,
      sin_marcar: Math.max(0, expected - marked),
      por_categoria: blocks,
    },
    tareas: { completadas: completed, vencidas_abiertas: overdue },
    tutor: {
      ejercicios: attempts.length,
      resueltos_solos: attempts.filter((a) => a.r === 1).length,
      horas_con_mas_ejercicios: tutorHours
        .map((n, h) => ({ h, n }))
        .filter((x) => x.n > 0)
        .sort((a, b) => b.n - a.n)
        .slice(0, 3)
        .map((x) => `${x.h}:00 (${x.n})`),
    },
    juegos: { promedio_min_dia: gameAvg, dias_mas_de_2h: games.filter((g) => g.totalMinutes > 120).length },
  };
}
