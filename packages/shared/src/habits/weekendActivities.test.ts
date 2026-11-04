import { checkWeekendActivity, isPlainHabit, weekendActivitiesOn } from './weekendActivities.js';

const activity = (id: string, day: number, extra: object = {}) => ({
  id,
  kind: 'WEEKEND_ACTIVITY',
  reminderDaysOfWeek: [day],
  ...extra,
});

describe('weekend activities', () => {
  const saturday = [activity('a', 6), activity('b', 6), activity('c', 6), activity('d', 0)];

  it('counts the live activities of a day, not habits or archived ones', () => {
    const habits = [
      ...saturday,
      { id: 'h', kind: 'HABIT', reminderDaysOfWeek: [6] },
      activity('x', 6, { archived: true }),
      activity('y', 6, { deletedAt: '2026-11-01T00:00:00Z' }),
    ];
    expect(weekendActivitiesOn(habits, 6)).toBe(3);
    expect(weekendActivitiesOn(habits, 0)).toBe(1);
  });

  it('refuses a fourth on Saturday and accepts one on Sunday', () => {
    const fourth = checkWeekendActivity(saturday, activity('e', 6));
    expect(fourth.ok).toBe(false);
    expect(!fourth.ok && fourth.error).toMatch(/3 actividades el sábado/);
    expect(checkWeekendActivity(saturday, activity('e', 0)).ok).toBe(true);
  });

  it('lets an existing one be edited in place', () => {
    expect(checkWeekendActivity(saturday, activity('a', 6, { title: 'renamed' })).ok).toBe(true);
  });

  it('wants exactly one weekend day', () => {
    expect(checkWeekendActivity([], activity('e', 3)).ok).toBe(false);
    expect(checkWeekendActivity([], { id: 'e', kind: 'WEEKEND_ACTIVITY', reminderDaysOfWeek: [6, 0] }).ok).toBe(false);
  });

  it('tells habits from activities, old habits without a kind included', () => {
    expect(isPlainHabit({})).toBe(true);
    expect(isPlainHabit({ kind: 'HABIT' })).toBe(true);
    expect(isPlainHabit({ kind: 'WEEKEND_ACTIVITY' })).toBe(false);
  });
});
