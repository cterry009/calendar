import { buildStudyStatus, manualNotesOf } from './build.js';

const now = new Date(2026, 9, 26, 12, 30);
const base = { focusEvents: [], catalog: [], noteFiles: new Map<string, string>(), now };

describe('study status', () => {
  it('keeps the hand-written notes', () => {
    const previous = '# x\n\n<!-- notas:inicio -->\n- Repasar Darboux\n<!-- notas:fin -->\n';
    expect(manualNotesOf(previous)).toBe('- Repasar Darboux');
    const { markdown } = buildStudyStatus({ ...base, snapshot: {}, previousMarkdown: previous });
    expect(markdown).toContain('<!-- notas:inicio -->\n- Repasar Darboux\n<!-- notas:fin -->');
  });

  it('counts flexible mornings by their real focus', () => {
    const block = (n: number, focusMinutes: number) => ({
      id: `block-m-2026-10-26-${n}`,
      flexible: true,
      scheduleId: 'm',
      blockStartAt: new Date(2026, 9, 26, 8 + 2 * n).toISOString(),
      completedCycles: 3,
      focusMinutes,
    });
    const { json, markdown } = buildStudyStatus({
      ...base,
      snapshot: { pomodoroSessions: [block(0, 72), block(1, 60)] },
      previousMarkdown: null,
      source: 'server',
    });
    expect((json.mananas as { hoy: unknown }).hoy).toEqual({
      bloques: 2,
      cumplidos: 2,
      meta: 2,
      cumplida: true,
    });
    expect(markdown).toContain('hoy 2 de 2 bloques cumplidos (mañana cumplida)');
    expect(markdown).toContain('| 2026-10-26 | 2 | 2 | 1 h 12 min · 1 h 00 min | ✅ |');
  });
});
