import { generateSuggestions } from './suggestions.js';

describe('suggestion engine', () => {
  it('suggests increasing estimates when hard tasks are underestimated', () => {
    const suggestions = generateSuggestions({
      estimationByDifficulty: {
        HARD: {
          avgErrorPct: 35,
          count: 6,
          tendency: 'underestimate',
        },
      },
    });

    expect(suggestions.some((item) => item.kind === 'underestimation')).toBe(true);
  });

  it('suggests breaks after long focus streaks', () => {
    const suggestions = generateSuggestions({
      focusStreaks: [
        { date: '2026-06-01', focusMinutes: 120, breakMinutes: 0 },
      ],
    });

    expect(suggestions.some((item) => item.kind === 'missing_break')).toBe(true);
  });

  it('detects pomodoro interruption hotspots', () => {
    const sessions = Array.from({ length: 4 }, (_, index) => ({
      interrupted: index < 2,
      startedAt: `2026-06-01T09:${index}0:00.000Z`,
      focusMinutes: 10,
    }));

    const suggestions = generateSuggestions({ pomodoroSessions: sessions });
    expect(suggestions.some((item) => item.kind === 'pomodoro_interruptions')).toBe(true);
  });
});
