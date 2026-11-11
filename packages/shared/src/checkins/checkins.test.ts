import { dueFixedSlot, dynamicReason } from './checkins';
import { gameBreakAllowed, gameBreakBudget, gameBreakWeek } from './gameBreaks';
import { blockSuggestion, primaryCause } from './blockSuggestions';

const at = (iso: string) => new Date(iso);

describe('fixed check-ins', () => {
  it('is due at the slot hour on weekdays, for 50 minutes, once', () => {
    expect(dueFixedSlot(at('2026-11-11T09:10:00'), new Set())).toBe(9);
    expect(dueFixedSlot(at('2026-11-11T09:55:00'), new Set())).toBeNull();
    expect(dueFixedSlot(at('2026-11-11T11:00:00'), new Set([11]))).toBeNull();
    expect(dueFixedSlot(at('2026-11-15T09:10:00'), new Set())).toBeNull(); // Sunday
  });
});

describe('dynamic check-ins', () => {
  const base = { minutesIntoBlock: null, focusedInBlock: false, recentGameMinutes: 0, minutesSinceLastPrompt: null, dynamicPromptsToday: 0, inFocus: false };
  it('asks when a block runs 20 min without focus or games drift in work time', () => {
    expect(dynamicReason({ ...base, minutesIntoBlock: 25 })).toBe('bloque-sin-foco');
    expect(dynamicReason({ ...base, recentGameMinutes: 16 })).toBe('juego-en-horario');
    expect(dynamicReason({ ...base, minutesIntoBlock: 10 })).toBeNull();
  });
  it('never during focus, not twice within 45 min, at most 4 a day', () => {
    expect(dynamicReason({ ...base, minutesIntoBlock: 30, inFocus: true })).toBeNull();
    expect(dynamicReason({ ...base, minutesIntoBlock: 30, minutesSinceLastPrompt: 20 })).toBeNull();
    expect(dynamicReason({ ...base, minutesIntoBlock: 30, dynamicPromptsToday: 4 })).toBeNull();
  });
});

describe('game breaks', () => {
  it('starts at 40 min and loses 5 a week down to 15', () => {
    expect(gameBreakBudget('2026-11-10')).toBe(40);
    expect(gameBreakWeek('2026-11-17')).toBe(2);
    expect(gameBreakBudget('2026-11-17')).toBe(35);
    expect(gameBreakBudget('2027-03-01')).toBe(15);
  });
  it('allows a break while budget and the 20-minute session limit last', () => {
    expect(gameBreakAllowed('2026-11-10', { usedToday: 10, currentSession: 5 })).toBe(true);
    expect(gameBreakAllowed('2026-11-10', { usedToday: 40, currentSession: 0 })).toBe(false);
    expect(gameBreakAllowed('2026-11-10', { usedToday: 10, currentSession: 20 })).toBe(false);
  });
});

describe('block suggestions', () => {
  it('picks by cause, night first, and avoids repeating the last one', () => {
    expect(primaryCause({ night: true, focus: true, gameBudgetSpent: true, workWindow: true, social: false })).toBe('noche');
    expect(primaryCause({ night: false, focus: true, gameBudgetSpent: false, workWindow: true, social: false })).toBe('foco');
    const first = blockSuggestion('foco', null, () => 0);
    expect(blockSuggestion('foco', first, () => 0)).not.toBe(first);
  });
});
