import { jest } from '@jest/globals';
import { HORARIO_2026 } from './horario.js';
import {
  defaultStudyPlanData,
  generatePlan,
  generatePlanWeek,
  milestoneTasks,
  nextMondayKey,
  occurrencesOnDate,
  planWeekOf,
  scheduleOnDate,
  swapExceptions,
  templateToSchedules,
  weekProgress,
  type PlanScheduleLike,
  type ScheduleExceptionLike,
} from './plan.js';
import { fitSequence, sequenceMinutes } from './sequence.js';
import { timetableImportBatch, WAKE_EXERCISE_HABIT_TITLE } from './importBatch.js';
import {
  canCutSegment,
  createSequenceBlockSession,
  getPhaseDurationMinutes,
  transitionPomodoro,
} from '../pomodoro/state-machine.js';
import { pomodoroTransitionEvents } from '../pomodoro/focus-events.js';
import type { PomodoroSession } from '../schemas/pomodoro.js';

const plan = defaultStudyPlanData('2026-10-19');
const schedules: PlanScheduleLike[] = templateToSchedules().map((s, i) => ({ ...s, id: `s${i}` }));
const byTitle = (title: string) => schedules.find((s) => s.label === title)!;

describe('plan start', () => {
  it('defaults to the next Monday', () => {
    expect(nextMondayKey(new Date(2026, 9, 15))).toBe('2026-10-19'); // a Thursday
    expect(nextMondayKey(new Date(2026, 9, 19))).toBe('2026-10-26'); // a Monday: the following one
  });

  it('counts weeks from the start Monday', () => {
    expect(planWeekOf(plan, '2026-10-19')).toBe(1);
    expect(planWeekOf(plan, '2026-10-25')).toBe(1);
    expect(planWeekOf(plan, '2026-10-26')).toBe(2);
    expect(planWeekOf(plan, '2026-10-18')).toBe(0);
  });
});

describe('template', () => {
  it('becomes one recurring schedule per distinct block, with its days', () => {
    expect(byTitle('Estudio B1').daysOfWeek).toEqual([1, 2, 4]);
    expect(byTitle('Código de las notas').daysOfWeek).toEqual([1, 5]);
    expect(byTitle('Almuerzo')).toMatchObject({ kind: 'REST', daysOfWeek: [1, 2, 3, 4, 5], startMinute: 750, endMinute: 840 });
    expect(byTitle('Estudio B1').sequence).toBe(HORARIO_2026.secuencias_pomodoro.manana);
    expect(byTitle('Proyecto de datos').sequence).toBe(HORARIO_2026.secuencias_pomodoro.tarde);
  });
});

describe('week generation', () => {
  it('generates week 1', () => {
    const week = generatePlanWeek(schedules, [], plan, 1);
    expect(week.start).toBe('2026-10-19');
    expect(week.phase?.nombre).toMatch(/^Fase 1/);
    const monday = week.days[0];
    expect(monday.date).toBe('2026-10-19');
    expect(monday.occurrences.map((o) => [o.startMinute, o.endMinute, o.title])).toEqual([
      [570, 750, 'Estudio B1'],
      [750, 840, 'Almuerzo'],
      [840, 925, 'Código de las notas'],
      [925, 935, 'Descanso'],
      [935, 1020, 'Maestrías: investigar programas'],
    ]);
    expect(monday.occurrences[0].description).toBe('Pensum geometría: 00b → 01a → AN1b (secciones 4-6) → 01 → 02');
    expect(monday.occurrences[1].description).toBeNull();
    // Afternoon pomodoros take the category's suggested labels.
    expect(monday.occurrences[2].segments!.filter((s) => s.tipo === 'foco').map((s) => s.etiqueta)).toEqual([
      'Planear y escribir',
      'Escribir y probar',
      'Probar, documentar, commit',
    ]);
    const saturday = week.days[5];
    expect(saturday.occurrences.map((o) => o.title)).toEqual([
      'Repaso y ejercicios atrasados: rehacer 2-3 ejercicios sin mirar la solución',
      'Descanso',
      'Código pendiente + revisar convocatorias y planear la semana',
    ]);
    expect(week.days[6].occurrences).toEqual([]);
    expect(week.milestones.map((m) => m.titulo)).toEqual([
      'Tabla de maestrías con fechas de cierre',
      'Definir a quién pedir las cartas de recomendación',
    ]);
  });

  it.each([
    [1, 'Fase 1', 'Pensum geometría: 00b → 01a → AN1b (secciones 4-6) → 01 → 02'],
    [6, 'Fase 2', 'Notas 04 → 07 (procesos estocásticos, Itô, SDEs, Fokker-Planck)'],
    [12, 'Fase 3', 'Pilar C → Pilar D'],
  ])('week %i is in %s and describes Estudio B1 from it', (weekNumber, phase, description) => {
    const week = generatePlanWeek(schedules, [], plan, weekNumber);
    expect(week.phase?.nombre.startsWith(phase)).toBe(true);
    expect(week.days[0].occurrences[0]).toMatchObject({ title: 'Estudio B1', description });
  });

  it('generates 14 weeks, with no phase description after them', () => {
    const weeks = generatePlan(schedules, [], plan);
    expect(weeks).toHaveLength(14);
    expect(weeks[13].start).toBe('2027-01-18');
    expect(occurrencesOnDate(schedules, [], plan, '2027-01-25')[0].description).toBeNull();
  });

  it('puts milestones on the Monday of their week', () => {
    const tasks = milestoneTasks(plan);
    expect(tasks).toHaveLength(13);
    expect(tasks.find((t) => t.title === 'SOP base v1')).toMatchObject({ date: '2026-11-16', category: 'carrera' });
  });
});

describe('sequences end exactly at the block end', () => {
  it.each([
    ['manana', 180],
    ['tarde', 85],
    ['sabado', 90],
  ] as const)('%s adds up to %i minutes', (name, minutes) => {
    const sequence = HORARIO_2026.secuencias_pomodoro[name];
    expect(sequenceMinutes(sequence)).toBe(minutes);
    const fitted = fitSequence(sequence, minutes);
    expect(fitted.warning).toBeNull();
    expect(fitted.segments.at(-1)!.endOffset).toBe(minutes);
  });

  it('trims the last segment of an edited sequence that runs long, and says so', () => {
    const edited = [...HORARIO_2026.secuencias_pomodoro.tarde, { tipo: 'pausa' as const, minutos: 10, etiqueta: 'Pausa' }];
    const fitted = fitSequence(edited, 85);
    expect(fitted.segments.at(-1)!.endOffset).toBe(85);
    expect(fitted.segments).toHaveLength(5);
    expect(fitted.warning).toMatch(/se recortó el último tramo/);
  });
});

describe('a morning block on the timer', () => {
  // Monday 19 Oct 2026, local time.
  const at = (h: number, m = 0) => new Date(2026, 9, 19, h, m);
  const morning = () =>
    createSequenceBlockSession('b', 'DEEP', at(9, 30).toISOString(), at(12, 30).toISOString(), HORARIO_2026.secuencias_pomodoro.manana);
  const endOf = (s: PomodoroSession) => new Date(new Date(s.startedAt!).getTime() + getPhaseDurationMinutes(s)! * 60_000);

  afterEach(() => jest.useRealTimers());

  it('runs every segment at its time and ends at 12:30', () => {
    jest.useFakeTimers({ now: at(9, 30) });
    let session = transitionPomodoro(morning(), { type: 'START' });
    const seen: Array<[string, string]> = [];
    while (session.active) {
      const end = endOf(session);
      seen.push([session.state, `${end.getHours()}:${String(end.getMinutes()).padStart(2, '0')}`]);
      jest.setSystemTime(end);
      session = transitionPomodoro(session, { type: session.state === 'FOCUS' ? 'FOCUS_COMPLETE' : 'BREAK_COMPLETE' });
    }
    expect(seen).toEqual([
      ['FOCUS', '10:00'],
      ['SHORT_BREAK', '10:05'],
      ['FOCUS', '10:45'],
      ['LONG_BREAK', '11:00'],
      ['FOCUS', '11:40'],
      ['SHORT_BREAK', '11:50'],
      ['FOCUS', '12:10'],
      ['SHORT_BREAK', '12:15'],
      ['FOCUS', '12:30'],
    ]);
    expect(session.endedAt).toBe(at(12, 30).toISOString());
    expect(session.interrupted).toBe(false);
    // Four pomodoros; the closing segment isn't one.
    expect(session.completedCycles).toBe(4);
  });

  it('started late, joins the segment running now', () => {
    jest.useFakeTimers({ now: at(10, 10) });
    const session = transitionPomodoro(morning(), { type: 'START' });
    expect(session).toMatchObject({ state: 'FOCUS', segmentIndex: 2 });
    expect(endOf(session).getTime()).toBe(at(10, 45).getTime());
  });

  it('started during a pause, starts the next focus early', () => {
    jest.useFakeTimers({ now: at(10, 2) });
    const session = transitionPomodoro(morning(), { type: 'START' });
    expect(session).toMatchObject({ state: 'FOCUS', segmentIndex: 2 });
    expect(endOf(session).getTime()).toBe(at(10, 45).getTime());
  });

  it('"cortar tramo" starts the next pause now without moving anything after it', () => {
    jest.useFakeTimers({ now: at(10, 5) });
    const running = transitionPomodoro(morning(), { type: 'START' });
    jest.setSystemTime(at(10, 20));
    expect(canCutSegment(running)).toBe(true);
    const cut = transitionPomodoro(running, { type: 'CUT_SEGMENT' });
    expect(cut).toMatchObject({ state: 'LONG_BREAK', segmentIndex: 3, cutCount: 1, completedCycles: 1 });
    // The long pause still ends at 11:00, when P3 starts as planned; the block still ends at 12:30.
    expect(endOf(cut).getTime()).toBe(at(11, 0).getTime());
    expect(cut.blockEndAt).toBe(at(12, 30).toISOString());
    expect(pomodoroTransitionEvents(running, cut).map((e) => e.kind)).toEqual(['FOCUS_COMPLETED', 'SEGMENT_CUT']);
    // Only a focus segment followed by a pause can be cut.
    expect(canCutSegment(cut)).toBe(false);
    expect(transitionPomodoro(cut, { type: 'CUT_SEGMENT' })).toBe(cut);
  });

  it('coming back after leaving joins the segment running now', () => {
    jest.useFakeTimers({ now: at(9, 30) });
    let session = transitionPomodoro(morning(), { type: 'START' });
    jest.setSystemTime(at(9, 50));
    session = transitionPomodoro(session, { type: 'PAUSE' });
    jest.setSystemTime(at(10, 50));
    session = transitionPomodoro(session, { type: 'RESUME' });
    expect(session).toMatchObject({ state: 'LONG_BREAK', segmentIndex: 3, pausedAt: null });
  });
});

describe('exceptions', () => {
  const codeBlock = byTitle('Código de las notas');
  // Week 3's Monday: the 14:00 block moves to carrera that day only.
  const moved: ScheduleExceptionLike = { scheduleId: codeBlock.id, date: '2026-11-02', category: 'carrera' };

  it('change only that day of that week', () => {
    const week3 = generatePlanWeek(schedules, [moved], plan, 3);
    const block = week3.days[0].occurrences.find((o) => o.scheduleId === codeBlock.id)!;
    expect(block).toMatchObject({ category: 'carrera', isException: true, startMinute: 840, endMinute: 925 });
    expect(block.description).toBe(plan.fases[0].contenido.carrera);
    expect(block.segments!.filter((s) => s.tipo === 'foco').map((s) => s.etiqueta)[2]).toBe('Cierre: anotar qué sigue');
    // Friday of the same week, and Monday of every other week, keep the template.
    const friday = week3.days[4].occurrences.find((o) => o.scheduleId === codeBlock.id)!;
    expect(friday).toMatchObject({ category: 'codigo_academico', isException: false });
    for (const week of generatePlan(schedules, [moved], plan).filter((w) => w.week !== 3)) {
      expect(week.days[0].occurrences.find((o) => o.scheduleId === codeBlock.id)).toMatchObject({
        category: 'codigo_academico',
        isException: false,
      });
    }
  });

  it('a moved block runs at its new time that day; a deleted exception is ignored', () => {
    const later = { scheduleId: codeBlock.id, date: '2026-11-02', startMinute: 17 * 60, endMinute: 18 * 60 + 25 };
    expect(scheduleOnDate(codeBlock, [later], '2026-11-02')).toMatchObject({ startMinute: 1020, endMinute: 1105 });
    expect(scheduleOnDate(codeBlock, [later], '2026-11-06')).toBe(codeBlock);
    expect(scheduleOnDate(codeBlock, [{ ...later, deletedAt: '2026-11-01T00:00:00Z' }], '2026-11-02')).toBe(codeBlock);
  });

  it('swapping two blocks exchanges their content and keeps their times', () => {
    const [code, career] = occurrencesOnDate(schedules, [], plan, '2026-10-19').filter((o) => o.kind === 'WORK').slice(1);
    const swapped = occurrencesOnDate(schedules, swapExceptions(code, career), plan, '2026-10-19').filter((o) => o.kind === 'WORK');
    expect(swapped[1]).toMatchObject({ startMinute: 840, title: career.title, category: 'carrera' });
    expect(swapped[2]).toMatchObject({ startMinute: 935, title: code.title, category: 'codigo_academico' });
  });
});

describe('weekly progress', () => {
  it('counts pomodoros by category and cuts in the week', () => {
    const b1 = byTitle('Estudio B1');
    const code = byTitle('Código de las notas');
    const sessions = [
      { scheduleId: b1.id, blockStartAt: new Date(2026, 9, 19, 9, 30).toISOString(), completedCycles: 4, cutCount: 1 },
      { scheduleId: b1.id, blockStartAt: new Date(2026, 9, 20, 9, 30).toISOString(), completedCycles: 3, cutCount: 2 },
      { scheduleId: code.id, blockStartAt: new Date(2026, 9, 19, 14, 0).toISOString(), completedCycles: 3 },
      // The next week: not counted.
      { scheduleId: b1.id, blockStartAt: new Date(2026, 9, 26, 9, 30).toISOString(), completedCycles: 4, cutCount: 1 },
    ];
    const moved = [{ scheduleId: code.id, date: '2026-10-19', category: 'carrera' }];
    expect(weekProgress(sessions, schedules, moved, '2026-10-19')).toEqual({
      pomodorosByCategory: { estudio_b1: 7, carrera: 3 },
      cuts: 3,
    });
  });
});

describe('loading the timetable', () => {
  const input = {
    startDate: '2026-10-19',
    schedules: [
      { id: 'old-work', kind: 'WORK' as const },
      { id: 'old-rest', kind: 'REST' as const },
    ],
    tasks: [],
    habits: [],
    now: '2026-10-15T12:00:00.000Z',
    newId: () => 'new-id',
  };

  it('deletes only the old WORK blocks, creates the template, the plan, 13 milestones and the exercise habit', () => {
    const batch = timetableImportBatch(input);
    expect(batch.schedules.filter((s) => s.deleted).map((s) => s.id)).toEqual(['old-work']);
    expect(batch.schedules.filter((s) => !s.deleted)).toHaveLength(templateToSchedules().length);
    expect(batch.studyPlan).toHaveLength(1);
    expect(batch.tasks).toHaveLength(13);
    expect(batch.habits).toEqual([expect.objectContaining({ title: WAKE_EXERCISE_HABIT_TITLE, reminderStartMinute: 480 })]);
  });

  it('does not repeat the exercise habit or the milestones already created', () => {
    const first = timetableImportBatch(input);
    const tasks = first.tasks.map((t, i) => ({ ...(t as object), id: `t${i}`, deletedAt: null }) as never);
    const again = timetableImportBatch({ ...input, tasks, habits: [{ title: WAKE_EXERCISE_HABIT_TITLE }] });
    expect(again.habits).toEqual([]);
    expect(again.tasks).toEqual([]);
  });
});
