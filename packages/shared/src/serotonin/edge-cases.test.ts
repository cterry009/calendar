import {
  createDefaultPillars,
  updatePillarMinutes,
  suggestNextPillar,
  suggestNextRitual,
  completeRitual,
  logMood,
  endSerotoninSession,
  calculateSerotoninScore,
  createSerotoninSession,
  SEROTONIN_RITUALS,
} from './index'

describe('Serotonin Edge Cases', () => {
  describe('suggestNextPillar', () => {
    it('suggests the first incomplete pillar by priority', () => {
      const pillars = createDefaultPillars();
      pillars[0].completed = true;
      const suggestion = suggestNextPillar(pillars);
      expect(suggestion).toBe('exercise');
    });

    it('returns first pillar when all have equal minutes', () => {
      const pillars = createDefaultPillars();
      const suggestion = suggestNextPillar(pillars);
      expect(pillars.some((p) => p.pillar === suggestion)).toBe(true);
    });
  });

  describe('suggestNextRitual', () => {
    it('suggests an uncompleted ritual', () => {
      const ritual = suggestNextRitual([]);
      expect(ritual).toBe('breathing');
    });

    it('skips already completed rituals', () => {
      const ritual = suggestNextRitual(['breathing', 'gratitude']);
      expect(ritual).not.toBe('breathing');
      expect(ritual).not.toBe('gratitude');
    });

    it('returns undefined when all rituals are completed', () => {
      const ritual = suggestNextRitual([...SEROTONIN_RITUALS]);
      expect(ritual).toBeNull();
    });
  });

  describe('completeRitual', () => {
    it('adds ritual to completed list', () => {
      const session = createSerotoninSession('test');
      const result = completeRitual(session, 'breathing');
      expect(result.completedRituals).toContain('breathing');
    });

    it('does not duplicate rituals', () => {
      const session = createSerotoninSession('test');
      const result = completeRitual(completeRitual(session, 'breathing'), 'breathing');
      expect(result.completedRituals.filter((r) => r === 'breathing')).toHaveLength(1);
    });
  });

  describe('logMood', () => {
    it('adds mood entry with timestamp', () => {
      const session = createSerotoninSession('test');
      const result = logMood(session, 'grateful');
      expect(result.moodCheckIns).toHaveLength(1);
      expect(result.moodCheckIns[0].mood).toBe('grateful');
      expect(result.moodCheckIns[0].at).toBeDefined();
    });
  });

  describe('endSerotoninSession', () => {
    it('sets endedAt and calculates score', () => {
      let session = createSerotoninSession('test');
      session = completeRitual(session, 'breathing');
      session = completeRitual(session, 'gratitude');
      const ended = endSerotoninSession(session);
      expect(ended.endedAt).toBeDefined();
      expect(ended.active).toBe(false);
      expect(ended.score).toBeGreaterThan(0);
    });
  });

  describe('calculateSerotoninScore', () => {
    it('returns 0 when no activity recorded', () => {
      const pillars = createDefaultPillars();
      const score = calculateSerotoninScore({
        pillars,
        completedRituals: [],
        moodCheckIns: [],
        screenTimeReductionPercent: 0,
      });
      expect(score).toBe(0);
    });

    it('rewards pillar minutes up to 50 points', () => {
      const pillars = createDefaultPillars().map((p) => ({ ...p, completed: true }));
      const score = calculateSerotoninScore({
        pillars,
        completedRituals: [],
        moodCheckIns: [],
        screenTimeReductionPercent: 0,
      });
      expect(score).toBeGreaterThanOrEqual(30);
      expect(score).toBeLessThanOrEqual(50);
    });

    it('rewards temptations avoided up to 10 points', () => {
      const pillars = createDefaultPillars();
      const scoreWithout = calculateSerotoninScore({
        pillars,
        completedRituals: [],
        moodCheckIns: [],
        temptationsAvoided: 0,
      });
      const scoreWith = calculateSerotoninScore({
        pillars,
        completedRituals: [],
        moodCheckIns: [],
        temptationsAvoided: 3,
      });
      const scoreCapped = calculateSerotoninScore({
        pillars,
        completedRituals: [],
        moodCheckIns: [],
        temptationsAvoided: 50,
      });
      expect(scoreWithout).toBe(0);
      expect(scoreWith).toBe(6);
      expect(scoreCapped).toBe(10);
    });

    it('caps screen time reduction at 6 points', () => {
      const pillars = createDefaultPillars();
      const score = calculateSerotoninScore({
        pillars,
        completedRituals: [],
        moodCheckIns: [],
        screenTimeReductionPercent: 100,
      });
      expect(score % 1).toBe(0);
    });
  });

  describe('updatePillarMinutes', () => {
    it('does not allow negative minutes', () => {
      const pillars = createDefaultPillars();
      const updated = updatePillarMinutes(pillars, 'outdoors', -10);
      const target = updated.find((p) => p.pillar === 'outdoors');
      expect(target!.minutes).toBe(0);
    });
  });
});


