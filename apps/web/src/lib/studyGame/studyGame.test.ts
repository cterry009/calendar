import { describe, expect, it } from 'vitest';
import type { ExerciseAttemptInput } from '@calendar/shared';
import { EMPTY_CHAT, loadChat, saveChat, withTurn, withUserMessage } from './chat';
import { studySectionsOf } from './studySections';
import { gameDashboard, pomodoroTutorSummary } from './summary';
import { currentForTurn, type TutorTurnResult } from './tutorApi';

describe('studySectionsOf', () => {
  it('reads the note from the clientId and the sections from the description', () => {
    expect(
      studySectionsOf({
        clientId: 'note:pensum_analisis.md#AN1#3.1',
        title: 'AN1 · Espacios métricos (1/2)',
        description: 'Pensum — Análisis real\nSecciones: 4-5.\nSesión 1 de 2 (~90 min).',
      }),
    ).toEqual({ noteCode: 'AN1', sections: ['4', '5'] });
  });

  it('adds the closings to a closing session and reads single sections', () => {
    expect(
      studySectionsOf({
        clientId: 'note:pensum_fund.md#00b#6',
        title: '00b · Cierre difícil/muy difícil',
        description: 'Secciones: 3.',
      }),
    ).toEqual({ noteCode: '00b', sections: ['3', 'cierre-rojo', 'cierre-negro'] });
  });

  it('gives nothing for a task that is not a study session or has no note code', () => {
    expect(studySectionsOf({ clientId: null, title: 'Correos', description: null })).toBeNull();
    expect(
      studySectionsOf({ clientId: 'note:pensum_pilar_A.md#3#1', title: 'x', description: null }),
    ).toBeNull();
  });
});

const exercise = {
  exerciseId: 'AN1#3#1',
  source: 'nota' as const,
  noteCode: 'AN1',
  section: '3',
  kind: 'sencillo' as const,
  b: -1,
  title: null,
  statement: 'Muestra que…',
  answer: 'Así.',
  hint: null,
};
const game = {
  noteCode: 'AN1',
  section: '3',
  theta: 0,
  level: 3,
  attempts: 0,
  xp: 0,
  globalLevel: 0,
  combo: 0,
  review: [],
  bosses: [],
};

describe('chat state', () => {
  it('adds the turn, keeps the conversation id and the last grade', () => {
    const attempt = {
      id: 'a1',
      exerciseId: 'AN1#3#1',
      exerciseSource: 'nota' as const,
      noteCode: 'AN1',
      section: '3',
      b: -1,
      r: 1 as const,
      hints: 0,
      minutes: null,
      gradedBy: 'claude' as const,
      supersedes: null,
      occurredAt: '2026-10-22T10:00:00Z',
      xpGained: 5,
      thetaBefore: 0,
      thetaAfter: 0.2,
    };
    const turn: TutorTurnResult = {
      sessionId: 's1',
      mensaje: 'Bien',
      accion: 'calificar',
      current: exercise,
      generateAt: null,
      attempt,
      game,
      warnings: ['nota'],
      durationMs: 9000,
    };
    const chat = withTurn(withUserMessage(EMPTY_CHAT, 'respuesta', 't0'), turn, 't1');
    expect(chat.messages.map((m) => m.role)).toEqual(['user', 'system', 'tutor']);
    expect(chat).toMatchObject({ sessionId: 's1', current: exercise, lastAttempt: attempt });
  });

  it('survives a reload through storage, and an unreadable storage gives an empty chat', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    } as Storage;
    saveChat('AN1', '3', { ...EMPTY_CHAT, sessionId: 's9' }, storage);
    expect(loadChat('AN1', '3', storage).sessionId).toBe('s9');
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
    } as unknown as Storage;
    expect(loadChat('AN1', '3', broken)).toEqual(EMPTY_CHAT);
  });

  it('sends a catalog exercise by id and a generated one with its text and b', () => {
    expect(currentForTurn(exercise)).toEqual({ exerciseId: 'AN1#3#1', source: 'nota' });
    expect(
      currentForTurn({ ...exercise, exerciseId: 'AN1#gen-ab12cd34', source: 'generado', b: 0.4 }),
    ).toEqual({
      exerciseId: 'AN1#gen-ab12cd34',
      source: 'generado',
      b: 0.4,
      statement: 'Muestra que…',
      answer: 'Así.',
    });
  });
});

function attempt(
  id: string,
  r: 0 | 0.5 | 1,
  minute: number,
  extra: Partial<ExerciseAttemptInput> & { pomodoroSessionId?: string } = {},
) {
  return {
    id,
    exerciseId: `AN1#3#${id}`,
    exerciseSource: 'nota' as const,
    noteCode: 'AN1',
    section: '3',
    b: 0,
    r,
    hints: 0,
    minutes: null,
    gradedBy: 'claude' as const,
    supersedes: null,
    occurredAt: new Date(Date.parse('2026-10-22T10:00:00Z') + minute * 60_000).toISOString(),
    ...extra,
  };
}

describe('game summaries', () => {
  it('sums the tutor work of one pomodoro', () => {
    const attempts = [
      attempt('1', 1, 0, { pomodoroSessionId: 'p0' }),
      attempt('2', 1, 50, { pomodoroSessionId: 'p1' }),
      attempt('3', 0.5, 55, { pomodoroSessionId: 'p1' }),
    ];
    const summary = pomodoroTutorSummary(attempts, 'p1')!;
    expect(summary).toMatchObject({ exercises: 2, sectionKey: 'AN1§3' });
    expect(summary.xp).toBeGreaterThan(0);
    expect(summary.thetaTo).not.toBe(summary.thetaFrom);
    expect(pomodoroTutorSummary(attempts, 'other')).toBeNull();
  });

  it('builds the dashboard rows per note and section', () => {
    const dashboard = gameDashboard([
      attempt('1', 1, 0),
      attempt('2', 0, 5, { noteCode: '00b', section: '2', exerciseId: '00b#2#1' }),
    ]);
    expect(dashboard.notes.map((n) => [n.noteCode, n.sections.map((s) => s.section)])).toEqual([
      ['00b', ['2']],
      ['AN1', ['3']],
    ]);
    expect(dashboard).toMatchObject({ attempts: 2, level: 0, nextLevelXp: 100 });
    expect(dashboard.review.map((r) => r.exerciseId)).toEqual(['00b#2#1']);
  });
});
