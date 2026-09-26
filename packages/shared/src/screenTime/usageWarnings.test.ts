import {
  USAGE_WARNING_THRESHOLD_MINUTES,
  evaluateUsageWarnings,
  isSocialDesktopApp,
  nextWarningThreshold,
  sumSocialDesktopMinutes,
  sumSocialMobileMinutes,
  usageWarningBody,
  usageWarningTitle,
  warningIntervalMinutes,
} from './usageWarnings.js';

describe('evaluateUsageWarnings', () => {
  it('stays quiet below the threshold', () => {
    expect(evaluateUsageWarnings({ socialMinutes: 59, gameMinutes: 59 })).toEqual([]);
  });

  it('fires exactly at the threshold, not only past it', () => {
    const warnings = evaluateUsageWarnings({ socialMinutes: 60, gameMinutes: 0 });
    expect(warnings).toEqual([{ category: 'SOCIAL', minutes: 60 }]);
  });

  it('reports both categories independently', () => {
    const warnings = evaluateUsageWarnings({ socialMinutes: 75, gameMinutes: 90 });
    expect(warnings.map((w) => w.category)).toEqual(['SOCIAL', 'GAMES']);
  });

  it('uses 60 minutes as the threshold', () => {
    expect(USAGE_WARNING_THRESHOLD_MINUTES).toBe(60);
  });

  it('stays quiet between intervals once a category has been warned', () => {
    // Warned at 60; the next one is not due until 90.
    expect(evaluateUsageWarnings({ socialMinutes: 75, gameMinutes: 0 }, { SOCIAL: 60 })).toEqual([]);
  });

  it('escalates each category on its own clock', () => {
    // Games warned at 120 (next due 135), social never warned (next due 60).
    const warnings = evaluateUsageWarnings(
      { socialMinutes: 61, gameMinutes: 130 },
      { GAMES: 120 },
    );
    expect(warnings.map((w) => w.category)).toEqual(['SOCIAL']);
  });
});

describe('escalation schedule', () => {
  it('spaces warnings 30 min apart through the second hour', () => {
    expect(warningIntervalMinutes(60)).toBe(30);
    expect(warningIntervalMinutes(119)).toBe(30);
  });

  it('tightens to 15 min past the second hour', () => {
    expect(warningIntervalMinutes(120)).toBe(15);
    expect(warningIntervalMinutes(179)).toBe(15);
  });

  it('tightens to 5 min past the third hour', () => {
    expect(warningIntervalMinutes(180)).toBe(5);
    expect(warningIntervalMinutes(400)).toBe(5);
  });

  it('walks the full sequence the way a real day would', () => {
    const marks: number[] = [];
    let last: number | null = null;
    for (let i = 0; i < 10; i++) {
      const due = nextWarningThreshold(last);
      marks.push(due);
      last = due;
    }
    expect(marks).toEqual([60, 90, 120, 135, 150, 165, 180, 185, 190, 195]);
  });

  it('fires once after a long gap instead of replaying every missed interval', () => {
    // App closed for hours, reopened at 200 minutes having last warned at 60.
    const warnings = evaluateUsageWarnings({ socialMinutes: 0, gameMinutes: 200 }, { GAMES: 60 });
    expect(warnings).toEqual([{ category: 'GAMES', minutes: 200 }]);

    // Recording the CURRENT minutes (not the crossed threshold) is what stops the backlog:
    // the next one is due at 205, not at 90.
    expect(nextWarningThreshold(200)).toBe(205);
  });
});

describe('sumSocialMobileMinutes', () => {
  it('adds up several feeds into one category total', () => {
    // The whole reason the threshold is per category: three 20-minute sessions are still an hour.
    const total = sumSocialMobileMinutes([
      { packageName: 'com.instagram.android', minutes: 20 },
      { packageName: 'com.zhiliaoapp.musically', minutes: 20 },
      { packageName: 'com.reddit.frontpage', minutes: 20 },
    ]);
    expect(total).toBe(60);
    expect(evaluateUsageWarnings({ socialMinutes: total, gameMinutes: 0 })).toHaveLength(1);
  });

  it('ignores apps outside the curated social list', () => {
    const total = sumSocialMobileMinutes([
      { packageName: 'com.instagram.android', minutes: 30 },
      { packageName: 'com.whatsapp', minutes: 200 },
      { packageName: 'com.android.chrome', minutes: 200 },
    ]);
    // Messaging is deliberately excluded, so only Instagram counts.
    expect(total).toBe(30);
  });
});

describe('sumSocialDesktopMinutes', () => {
  it('counts dedicated desktop social clients', () => {
    const total = sumSocialDesktopMinutes([
      { key: 'instagram.exe', minutes: 25 },
      { key: 'code.exe', minutes: 120 },
    ]);
    expect(total).toBe(25);
  });

  it('does not count browsers, which it cannot attribute', () => {
    // Documented, structural gap: desktop social lives in browser tabs and the tracker never
    // reads window titles. This asserts the honest behaviour rather than a guess.
    const total = sumSocialDesktopMinutes([
      { key: 'chrome.exe', minutes: 180 },
      { key: 'msedge.exe', minutes: 60 },
    ]);
    expect(total).toBe(0);
  });

  it('matches case-insensitively, like the rest of the exe keys', () => {
    expect(isSocialDesktopApp('Instagram.EXE')).toBe(true);
    expect(isSocialDesktopApp('chrome.exe')).toBe(false);
  });
});

describe('warning copy', () => {
  it('formats hours and minutes readably', () => {
    expect(usageWarningBody({ category: 'GAMES', minutes: 90 })).toContain('1 h 30 min');
    expect(usageWarningBody({ category: 'SOCIAL', minutes: 60 })).toContain('1 h');
  });

  it('names the category in the title', () => {
    expect(usageWarningTitle('SOCIAL')).toContain('redes sociales');
    expect(usageWarningTitle('GAMES')).toContain('juego');
  });
});
