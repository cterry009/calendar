import { createDetoxPlan } from './index.js';
import { proposeDetoxSchedules } from './schedules.js';

describe('detox schedule proposals', () => {
  it('returns phase-specific schedule proposals', () => {
    const plan = createDetoxPlan('plan-1');
    const proposals = proposeDetoxSchedules(plan);

    expect(proposals.length).toBeGreaterThan(0);
    expect(proposals.every((item) => item.kind === 'WORK' || item.kind === 'REST')).toBe(true);
    expect(proposals.some((item) => item.label.includes('[Detox]'))).toBe(true);
  });
});
