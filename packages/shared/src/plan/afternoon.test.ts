import { afternoonTargets, afternoonV3Changes, needsAfternoonUpdate, needsPlanV3, planV3 } from './afternoon.js';
import { defaultStudyPlanData, templateToSchedules } from './plan.js';

// The afternoons as they were before 2026-11-08 (horario JSON + revision 2's times).
const before = [
  { id: 'ca', kind: 'WORK' as const, daysOfWeek: [1, 5], startMinute: 840, endMinute: 930, label: 'Código de las notas', category: 'codigo_academico', flexibleBlocks: 1, enabled: true },
  { id: 'pd', kind: 'WORK' as const, daysOfWeek: [2], startMinute: 840, endMinute: 930, label: 'Proyecto de datos', category: 'codigo_datos', flexibleBlocks: 1, enabled: true },
  { id: 'in', kind: 'WORK' as const, daysOfWeek: [3], startMinute: 840, endMinute: 930, label: 'Investigación PINN (experimentos del Pilar E)', category: 'investigacion', flexibleBlocks: 1, enabled: true },
  { id: 'sq', kind: 'WORK' as const, daysOfWeek: [4], startMinute: 840, endMinute: 930, label: 'SQL + proyecto de datos', category: 'codigo_datos', flexibleBlocks: 1, enabled: true },
  { id: 'm1', kind: 'WORK' as const, daysOfWeek: [1], startMinute: 960, endMinute: 1050, label: 'Maestrías: investigar programas', category: 'carrera', flexibleBlocks: 1, enabled: true },
  { id: 'cv', kind: 'WORK' as const, daysOfWeek: [2], startMinute: 960, endMinute: 1050, label: 'CV: las 3 versiones + CV académico', category: 'carrera', flexibleBlocks: 1, enabled: true },
  { id: 'm2', kind: 'WORK' as const, daysOfWeek: [3], startMinute: 960, endMinute: 1050, label: 'Maestrías: documentos (carta, SOP)', category: 'carrera', flexibleBlocks: 1, enabled: true },
  { id: 'tr', kind: 'WORK' as const, daysOfWeek: [4], startMinute: 960, endMinute: 1050, label: 'Trabajo: aplicaciones dirigidas', category: 'carrera', flexibleBlocks: 1, enabled: true },
  { id: 'm3', kind: 'WORK' as const, daysOfWeek: [5], startMinute: 960, endMinute: 1050, label: 'Maestrías: correos', category: 'carrera', flexibleBlocks: 1, enabled: true },
  { id: 'b1', kind: 'WORK' as const, daysOfWeek: [1, 2, 4], startMinute: 540, endMinute: 630, label: 'Estudio B1', category: 'estudio_b1', flexibleBlocks: 1, enabled: true },
  { id: 'lu', kind: 'REST' as const, daysOfWeek: [1, 2, 3, 4, 5], startMinute: 780, endMinute: 840, label: 'Almuerzo', category: null, flexibleBlocks: null, enabled: true },
];

/** Who does what on each weekday afternoon, as "day start category". */
function cells(schedules: Array<{ kind: string; daysOfWeek: number[]; startMinute: number; category?: string | null; enabled?: boolean }>) {
  return schedules
    .filter((s) => s.kind === 'WORK' && s.startMinute >= 780 && s.enabled !== false)
    .flatMap((s) => s.daysOfWeek.filter((d) => d >= 1 && d <= 5).map((d) => `${d} ${s.startMinute} ${s.category}`))
    .sort();
}

describe('afternoonV3Changes', () => {
  it('gives the 2026-11-08 afternoons keeping ids, disabling the leftover and leaving mornings and lunch alone', () => {
    const c = afternoonV3Changes(before);
    expect(c.creates).toEqual([]);
    expect(c.disables.map((s) => s.id)).toEqual(['tr']);
    expect(c.updates.map((s) => s.id).sort()).toEqual(['ca', 'cv', 'in', 'm1', 'm2', 'm3', 'sq']);
    expect(c.updates.find((s) => s.id === 'in')?.daysOfWeek).toEqual([1, 3]);
    expect(c.updates.find((s) => s.id === 'ca')?.daysOfWeek).toEqual([5]);
    expect(c.updates.find((s) => s.id === 'sq')?.category).toBe('paper');

    const applied = before.map(
      (s) => c.updates.find((u) => u.id === s.id) ?? c.disables.find((d) => d.id === s.id) ?? s,
    );
    expect(cells(applied)).toEqual(cells(afternoonTargets()));
    expect(cells(applied)).toEqual(
      [
        '1 840 investigacion', '1 960 maestria',
        '2 840 codigo_datos', '2 960 carrera',
        '3 840 investigacion', '3 960 paper',
        '4 840 paper', '4 960 maestria',
        '5 840 codigo_academico', '5 960 carrera',
      ].sort(),
    );
    expect(needsAfternoonUpdate(applied)).toBe(false);
  });

  it('a fresh template needs no update', () => {
    const fresh = templateToSchedules().map((s, i) => ({ ...s, id: `s${i}`, enabled: true }));
    expect(needsAfternoonUpdate(fresh)).toBe(false);
  });

  it('creates what no schedule can take', () => {
    const c = afternoonV3Changes([]);
    expect(c.creates.length).toBe(afternoonTargets().length);
    expect(c.updates).toEqual([]);
  });
});

describe('planV3', () => {
  it('rewrites carrera and adds maestria and paper, keeping the rest of the plan', () => {
    const old = defaultStudyPlanData('2026-10-19');
    const stale = {
      ...old,
      fases: old.fases.map((f) => {
        const { maestria: _m, paper: _p, ...rest } = f.contenido;
        return { ...f, contenido: { ...rest, carrera: 'Tabla de 8-12 maestrías', codigo_datos: 'mío' } };
      }),
      pomodoros_sugeridos: { repaso: ['a'] },
    };
    expect(needsPlanV3(stale)).toBe(true);
    const next = planV3(stale);
    expect(next.fases[0].contenido.carrera).toMatch(/^UNAL/);
    expect(next.fases[1].contenido.maestria).toMatch(/HJB/);
    expect(next.fases[2].contenido.paper).toMatch(/envío/);
    expect(next.fases[0].contenido.codigo_datos).toBe('mío');
    expect(next.pomodoros_sugeridos.repaso).toEqual(['a']);
    expect(next.pomodoros_sugeridos.paper?.[0]).toBe('Reproducir el caso que falla');
    expect(needsPlanV3(next)).toBe(false);
  });
});
