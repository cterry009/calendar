import {
  calculateSerotoninScore,
  createDefaultPillars,
  createSerotoninSession,
  completeRitual,
  logPillarActivity,
  recordTemptationAvoided,
  suggestNextPillar,
} from './index.js';

describe('serotonin mode', () => {
  it('calculates score from pillars and rituals', () => {
    const pillars = createDefaultPillars();
    pillars[0].completed = true;
    pillars[1].completed = true;
    pillars[2].completed = true;
    const score = calculateSerotoninScore({
      pillars,
      completedRituals: ['breathing', 'gratitude'],
      moodCheckIns: [{ mood: 'calm' }],
    });
    expect(score).toBeGreaterThan(40);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('suggests next incomplete pillar', () => {
    const pillars = createDefaultPillars();
    pillars[0].completed = true;
    expect(suggestNextPillar(pillars)).toBe('exercise');
  });

  it('updates session on ritual completion', () => {
    let session = createSerotoninSession('test-1');
    session = completeRitual(session, 'breathing');
    expect(session.completedRituals).toContain('breathing');
    expect(session.score).toBeGreaterThan(0);
  });

  it('marks pillar complete when target minutes reached', () => {
    let session = createSerotoninSession('test-2');
    session = logPillarActivity(session, 'outdoors', 15);
    const outdoors = session.pillars.find((p) => p.pillar === 'outdoors');
    expect(outdoors?.completed).toBe(true);
  });

  it('counts a declined exit as a temptation avoided and raises the score', () => {
    let session = createSerotoninSession('test-3');
    expect(session.temptationsAvoided).toBe(0);
    session = recordTemptationAvoided(session);
    expect(session.temptationsAvoided).toBe(1);
    expect(session.score).toBeGreaterThan(0);
  });
});
