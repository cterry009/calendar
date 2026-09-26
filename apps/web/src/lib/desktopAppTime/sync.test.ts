import { describe, expect, it } from 'vitest';
import { buildDailyDesktopAppTimeUpsert } from './sync';

describe('buildDailyDesktopAppTimeUpsert', () => {
  it('sorts apps by minutes descending', () => {
    const upsert = buildDailyDesktopAppTimeUpsert([
      { key: 'code.exe', label: 'Visual Studio Code', minutes: 12 },
      { key: 'chrome.exe', label: 'Google Chrome', minutes: 47 },
      { key: 'slack.exe', label: 'Slack', minutes: 30 },
    ]);

    expect(upsert.topApps.map((app) => app.key)).toEqual([
      'chrome.exe',
      'slack.exe',
      'code.exe',
    ]);
    expect(upsert.totalMinutes).toBe(89);
  });

  it('drops the sub-minute tail alt-tabbing leaves behind', () => {
    const upsert = buildDailyDesktopAppTimeUpsert([
      { key: 'chrome.exe', label: 'Google Chrome', minutes: 20 },
      { key: 'explorer.exe', label: 'Explorador de archivos', minutes: 0 },
      { key: 'cmd.exe', label: 'Símbolo del sistema', minutes: 0 },
    ]);

    expect(upsert.topApps).toHaveLength(1);
    expect(upsert.totalMinutes).toBe(20);
  });

  it('caps the list at ten apps while still totalling every app used', () => {
    const entries = Array.from({ length: 14 }, (_, index) => ({
      key: `app${index}.exe`,
      label: `App ${index}`,
      minutes: index + 1,
    }));

    const upsert = buildDailyDesktopAppTimeUpsert(entries);

    expect(upsert.topApps).toHaveLength(10);
    // 1..14 summed -- the four apps that missed the top-10 cut still count toward the total.
    expect(upsert.totalMinutes).toBe(105);
  });

  it('dates the rollup to the start of the local day', () => {
    const upsert = buildDailyDesktopAppTimeUpsert([
      { key: 'chrome.exe', label: 'Google Chrome', minutes: 5 },
    ]);

    const date = new Date(upsert.date);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
    expect(date.getDate()).toBe(new Date().getDate());
  });

  it('returns an empty rollup when nothing reached a full minute', () => {
    const upsert = buildDailyDesktopAppTimeUpsert([
      { key: 'chrome.exe', label: 'Google Chrome', minutes: 0 },
    ]);

    expect(upsert.topApps).toEqual([]);
    expect(upsert.totalMinutes).toBe(0);
  });
});
