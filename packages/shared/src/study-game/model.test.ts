import {
  firstUnmasteredSection,
  globalLevel,
  logit,
  probability,
  sectionLevel,
  stepSize,
  updateTheta,
  xpForLevel,
} from './model.js';

describe('probability', () => {
  it('is one half when ability equals difficulty', () => {
    expect(probability(0, 0)).toBe(0.5);
    expect(probability(1.3, 1.3)).toBe(0.5);
  });

  it('is the inverse of logit', () => {
    expect(probability(logit(0.8), 0)).toBeCloseTo(0.8, 12);
  });
});

describe('updateTheta', () => {
  it('rises a lot after an improbable success and little after a probable one', () => {
    const hard = updateTheta(0, 2, 1, 0) - 0;
    const easy = updateTheta(0, -2, 1, 0) - 0;
    expect(hard).toBeGreaterThan(0);
    expect(easy).toBeGreaterThan(0);
    expect(hard).toBeGreaterThan(easy);
  });

  it('drops little after a likely failure and a lot after a surprising one', () => {
    const likely = updateTheta(0, 2, 0, 0) - 0;
    const surprising = updateTheta(0, -2, 0, 0) - 0;
    expect(likely).toBeLessThan(0);
    expect(surprising).toBeLessThan(likely);
  });

  it('does not move when half credit matches the expected chance', () => {
    expect(updateTheta(0, 0, 0.5, 0)).toBe(0);
  });

  it('takes smaller steps as the section gathers attempts, down to the floor', () => {
    expect(stepSize(0)).toBeCloseTo(0.8);
    expect(stepSize(3)).toBeCloseTo(0.4);
    expect(stepSize(1000)).toBe(0.15);
  });

  it('throws on a grade other than 0, 0.5 or 1', () => {
    expect(() => updateTheta(0, 0, 0.7, 0)).toThrow(/0, 0.5 or 1/);
    expect(() => updateTheta(0, 0, -1, 0)).toThrow();
  });
});

describe('levels', () => {
  it('climbs the section ladder at the b₀ of each kind', () => {
    expect([-1.5, -1, -0.2, 0, 1, 2, 3].map((t) => sectionLevel(t))).toEqual([1, 2, 2, 3, 4, 5, 5]);
  });

  it('needs 100·n^1.5 XP for global level n', () => {
    expect(xpForLevel(4)).toBe(800);
    expect(globalLevel(0)).toBe(0);
    expect(globalLevel(99)).toBe(0);
    expect(globalLevel(100)).toBe(1);
    expect(globalLevel(799)).toBe(3);
    expect(globalLevel(800)).toBe(4);
  });
});

describe('firstUnmasteredSection', () => {
  const levels: Record<string, number> = { '6': 2, '7': 3, '8': 4, '9': 1 };
  it('skips sections at level 3 or more and keeps the order', () => {
    expect(firstUnmasteredSection(['7', '8', '9', '6'], (s) => levels[s])).toBe('9');
    expect(firstUnmasteredSection(['6', '7'], (s) => levels[s])).toBe('6');
  });
  it('treats an unknown level as not mastered, and returns null when all are', () => {
    expect(firstUnmasteredSection(['7', '10'], (s) => levels[s])).toBe('10');
    expect(firstUnmasteredSection(['7', '8'], (s) => levels[s])).toBeNull();
  });
});
