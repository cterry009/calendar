import {
  completeBaselineAudit,
  completeDetoxDay,
  createDetoxPlan,
  getDetoxDayPlan,
  isDetoxDayComplete,
  toggleDetoxChecklistItem,
} from './index.js';

describe('serotonin detox plan', () => {
  it('creates a 7-day default plan', () => {
    const plan = createDetoxPlan('detox-1');
    expect(plan.durationDays).toBe(7);
    expect(plan.currentDay).toBe(1);
  });

  it('returns day plan with phase and checklist', () => {
    const plan = createDetoxPlan('detox-2');
    const dayPlan = getDetoxDayPlan(plan, 1);

    expect(dayPlan?.phase).toBe('audit');
    expect(dayPlan?.checklist.length).toBeGreaterThan(0);
  });

  it('tracks checklist completion and day progression', () => {
    let plan = createDetoxPlan('detox-3');
    plan = completeBaselineAudit(plan, {
      screenTimeHoursEstimate: 5,
      topDistractions: ['instagram', 'youtube'],
    });

    const dayPlan = getDetoxDayPlan(plan, 1)!;
    for (const item of dayPlan.checklist) {
      plan = toggleDetoxChecklistItem(plan, 1, item.id);
    }

    expect(isDetoxDayComplete(plan, 1)).toBe(true);

    plan = completeDetoxDay(plan, 1);
    expect(plan.completedDays).toContain(1);
    expect(plan.currentDay).toBe(2);
    expect(plan.progressPercent).toBeGreaterThan(0);
  });
});
