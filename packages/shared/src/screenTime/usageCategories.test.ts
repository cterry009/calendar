import { formatUsageDuration, summarizeUsageByCategory, usageCategoryOf } from './usageCategories.js';

const MIN = 60_000;

describe('usage categories', () => {
  it('classifies social (the blocking list), streaming and Android games', () => {
    expect(usageCategoryOf({ packageName: 'com.instagram.android' })).toBe('SOCIAL');
    expect(usageCategoryOf({ packageName: 'com.google.android.youtube' })).toBe('SOCIAL');
    expect(usageCategoryOf({ packageName: 'com.netflix.mediaclient' })).toBe('STREAMING');
    expect(usageCategoryOf({ packageName: 'com.supercell.clashroyale', isGame: true })).toBe('GAMES');
    expect(usageCategoryOf({ packageName: 'com.whatsapp' })).toBeNull();
  });

  it('adds up each bucket, most used app first', () => {
    const summary = summarizeUsageByCategory([
      { packageName: 'com.instagram.android', totalTimeMs: 20 * MIN },
      { packageName: 'com.zhiliaoapp.musically', totalTimeMs: 45 * MIN },
      { packageName: 'com.netflix.mediaclient', totalTimeMs: 90 * MIN },
      { packageName: 'com.game.one', totalTimeMs: 15 * MIN, isGame: true },
      { packageName: 'com.whatsapp', totalTimeMs: 60 * MIN },
    ]);
    expect(summary.SOCIAL.totalMs).toBe(65 * MIN);
    expect(summary.SOCIAL.apps.map((a) => a.packageName)).toEqual(['com.zhiliaoapp.musically', 'com.instagram.android']);
    expect(summary.STREAMING.totalMs).toBe(90 * MIN);
    expect(summary.GAMES.totalMs).toBe(15 * MIN);
  });

  it('formats durations', () => {
    expect(formatUsageDuration(0)).toBe('0 min');
    expect(formatUsageDuration(45 * MIN)).toBe('45 min');
    expect(formatUsageDuration(125 * MIN)).toBe('2 h 05 min');
  });
});
