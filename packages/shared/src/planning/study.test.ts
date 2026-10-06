import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  STUDY_LINE_MAP,
  currentStudySession,
  describeOccurrence,
  nextBlockOccurrence,
  studyLineOf,
  studyLinesForBlock,
  studyProgress,
  studySessionLine,
} from './study.js';

const task = (clientId: string, n: number, status = 'PENDING') => ({
  id: clientId,
  clientId,
  title: clientId.split('#').slice(1).join(' '),
  status,
  createdAt: `2026-10-02T00:00:${String(n).padStart(2, '0')}.000Z`,
});

describe('study sessions', () => {
  it('mirrors the planner reference map (docs/planning/mapa-lineas.json)', () => {
    const doc = JSON.parse(readFileSync(join(process.cwd(), '../../docs/planning/mapa-lineas.json'), 'utf8')) as {
      bloques: { titulo_contiene: string; lineas: string[] }[];
    };
    expect(STUDY_LINE_MAP).toEqual(doc.bloques.map((b) => ({ titleContains: b.titulo_contiene, lines: b.lineas })));
  });

  it('reads the line from the clientId and the lines from the block label', () => {
    expect(studyLineOf({ clientId: 'note:pensum_analisis.md#AN1#3.2' })).toBe('pensum_analisis.md');
    expect(studyLineOf({ clientId: 'ai:123#1' })).toBeNull();
    expect(studyLinesForBlock('Estudio B2 (línea paralela)')[0]).toBe('pensum_analisis.md');
    expect(studyLinesForBlock('CV: las 3 versiones')).toEqual([]);
  });

  it('is on the first pending session of its lines; one not done stays first, a done one moves it on', () => {
    const tasks = [
      task('note:pensum_analisis.md#AN1#1', 1, 'COMPLETED'),
      task('note:pensum_analisis.md#AN1#2', 2),
      task('note:pensum_analisis.md#AN1#3', 3),
      task('note:pensum_pilar_A.md#A1#1', 4),
    ];
    expect(currentStudySession('Estudio B2', tasks)?.clientId).toBe('note:pensum_analisis.md#AN1#2');
    // The whole first line done: the next line.
    const allDone = tasks.map((t) => (t.clientId.includes('analisis') ? { ...t, status: 'COMPLETED' } : t));
    expect(currentStudySession('Estudio B2', allDone)?.clientId).toBe('note:pensum_pilar_A.md#A1#1');
    expect(currentStudySession('Trabajo: aplicaciones', tasks)).toBeNull();
  });

  it('counts progress per line', () => {
    const progress = studyProgress([task('note:pensum_analisis.md#AN1#1', 1, 'COMPLETED'), task('note:pensum_analisis.md#AN1#2', 2)]);
    expect(progress.find((p) => p.line === 'pensum_analisis.md')).toMatchObject({ done: 1, total: 2, next: 'AN1 2', name: 'Análisis' });
    expect(progress.find((p) => p.line === 'pensum_pilar_B.md')).toMatchObject({ done: 0, total: 0, next: null });
  });
});

describe('nextBlockOccurrence', () => {
  it('finds the next day the block happens, after today', () => {
    // Tuesday 2026-10-06; block Mon-Thu 11:00.
    const next = nextBlockOccurrence({ daysOfWeek: [1, 2, 3, 4], startMinute: 660 }, new Date(2026, 9, 6, 11, 30));
    expect(next?.toString()).toBe(new Date(2026, 9, 7, 11, 0).toString());
    expect(describeOccurrence(next!)).toBe('el miércoles 7 a las 11:00');
    // Friday block from a Friday: a week later.
    expect(nextBlockOccurrence({ daysOfWeek: [5], startMinute: 960 }, new Date(2026, 9, 9))?.getDate()).toBe(16);
  });
});

describe('studySessionLine', () => {
  it('says which pomodoro of the session, or that it is done', () => {
    const t = { title: 'AN1 · Compacidad (2/3)', status: 'PENDING', estimatedPomodoros: 2 };
    expect(studySessionLine(t, { state: 'FOCUS', completedCycles: 0 })).toBe('AN1 · Compacidad (2/3) · pomodoro 1 de 2');
    expect(studySessionLine(t, { state: 'SHORT_BREAK', completedCycles: 1 })).toBe('AN1 · Compacidad (2/3) · pomodoro 1 de 2');
    expect(studySessionLine({ ...t, status: 'COMPLETED' }, { state: 'FOCUS', completedCycles: 2 })).toBe('✓ AN1 · Compacidad (2/3): sesión completada');
  });
});
