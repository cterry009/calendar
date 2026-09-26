import { categorizeBlockedEntry, pickActivitySuggestion } from './activitySuggestions.js';

describe('categorizeBlockedEntry', () => {
  it('treats WEBSITE blocks as social', () => {
    expect(categorizeBlockedEntry('WEBSITE', 'instagram.com')).toBe('SOCIAL');
  });

  it('treats DESKTOP_APP blocks as games', () => {
    expect(categorizeBlockedEntry('DESKTOP_APP', 'steam:1142710')).toBe('GAME');
    expect(categorizeBlockedEntry('DESKTOP_APP', 'leagueclientux.exe')).toBe('GAME');
  });

  it('treats a known social MOBILE_APP package as social', () => {
    expect(categorizeBlockedEntry('MOBILE_APP', 'com.instagram.android')).toBe('SOCIAL');
  });

  it('treats an unknown MOBILE_APP package as generic', () => {
    expect(categorizeBlockedEntry('MOBILE_APP', 'com.some.random.app')).toBe('GENERIC');
  });
});

describe('pickActivitySuggestion', () => {
  it('always returns a non-empty suggestion for every category', () => {
    for (const category of ['SOCIAL', 'GAME', 'GENERIC'] as const) {
      for (let i = 0; i < 20; i += 1) {
        expect(pickActivitySuggestion(category).length).toBeGreaterThan(0);
      }
    }
  });
});
