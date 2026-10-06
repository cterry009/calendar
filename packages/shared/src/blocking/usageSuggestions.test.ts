import { finishPomodoroPhrase } from './finishPhrases.js';
import { normalizeWebsiteDomain, rankUsageSuggestions, websiteLabel, websiteMatches } from './usageSuggestions.js';

describe('rankUsageSuggestions', () => {
  it('ranks by minutes and drops blocked, essential and unused items', () => {
    const ranked = rankUsageSuggestions(
      [
        { identifier: 'com.whatsapp', label: 'WhatsApp', minutes: 90 },
        { identifier: 'com.sec.android.app.launcher', label: 'Inicio', minutes: 300 },
        { identifier: 'com.reddit.frontpage', label: 'Reddit', minutes: 120 },
        { identifier: 'com.duolingo', label: 'Duolingo', minutes: 15 },
        { identifier: 'com.spotify.music', label: 'Spotify', minutes: 0 },
        { identifier: 'app.calendarproductivity.mobile', label: 'Calendar', minutes: 50 },
      ],
      ['com.duolingo'],
    );
    expect(ranked.map((i) => i.identifier)).toEqual(['com.reddit.frontpage', 'com.whatsapp']);
  });

  it('merges the same identifier and respects the limit', () => {
    const ranked = rankUsageSuggestions(
      [
        { identifier: 'youtube.com', label: 'Youtube', minutes: 10 },
        { identifier: 'YouTube.com', label: 'Youtube', minutes: 25 },
        { identifier: 'reddit.com', label: 'Reddit', minutes: 30 },
      ],
      [],
      1,
    );
    expect(ranked).toEqual([{ identifier: 'youtube.com', label: 'Youtube', minutes: 35 }]);
  });

  it('matches already-blocked identifiers case-insensitively', () => {
    expect(rankUsageSuggestions([{ identifier: 'Discord.exe', label: 'Discord', minutes: 60 }], ['discord.exe'])).toEqual([]);
  });
});

describe('websites', () => {
  it('normalizes what people type or paste to a bare domain', () => {
    expect(normalizeWebsiteDomain('https://www.YouTube.com/feed?x=1')).toBe('youtube.com');
    expect(normalizeWebsiteDomain(' instagram.com ')).toBe('instagram.com');
    expect(normalizeWebsiteDomain('mail.google.com:443/u/0')).toBe('mail.google.com');
  });

  it('rejects things that are not domains', () => {
    expect(normalizeWebsiteDomain('youtube')).toBeNull();
    expect(normalizeWebsiteDomain('buscar algo')).toBeNull();
    expect(normalizeWebsiteDomain('chrome://newtab')).toBeNull();
    expect(normalizeWebsiteDomain('')).toBeNull();
  });

  it('a blocked domain covers its subdomains, not look-alikes', () => {
    expect(websiteMatches('m.youtube.com', 'youtube.com')).toBe(true);
    expect(websiteMatches('youtube.com', 'https://www.youtube.com/')).toBe(true);
    expect(websiteMatches('notyoutube.com', 'youtube.com')).toBe(false);
  });

  it('labels a domain readably', () => {
    expect(websiteLabel('youtube.com')).toBe('Youtube');
    expect(websiteLabel('mail.google.com')).toBe('Mail Google');
  });
});

describe('finishPomodoroPhrase', () => {
  it('names the minutes left, keeps one line per seed, and has lines for the last minutes and for a pause', () => {
    expect(finishPomodoroPhrase(12.2, 's1:1')).toBe(finishPomodoroPhrase(12.2, 's1:1'));
    expect(finishPomodoroPhrase(12.2, 's1:1')).toMatch(/13|Lo difícil|No hace falta|tendrás|foco/);
    expect(finishPomodoroPhrase(1, 'x')).toMatch(/minuto|recta final|a punto/);
    const paused = finishPomodoroPhrase(8, 'p', true);
    expect(paused).toMatch(/8 minutos|Lo pausaste/);
  });
});
