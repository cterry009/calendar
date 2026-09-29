import { describe, expect, it } from 'vitest';
import { ALL_GAMES_IDENTIFIER, focusBlockTargets } from './focusBlockTargets';

describe('focusBlockTargets', () => {
  it('blocks nothing extra outside a focus', () => {
    expect(focusBlockTargets(false)).toEqual({ processes: [], websites: [] });
  });

  it('blocks every game and the social apps and sites during a focus', () => {
    const targets = focusBlockTargets(true);
    expect(targets.processes).toContain(ALL_GAMES_IDENTIFIER);
    expect(targets.processes).toContain('instagram.exe');
    expect(targets.websites).toEqual(expect.arrayContaining(['instagram.com', 'tiktok.com', 'x.com', 'reddit.com']));
  });

  it('leaves messaging alone', () => {
    const { processes, websites } = focusBlockTargets(true);
    expect(processes).not.toContain('whatsapp.exe');
    expect(websites).not.toContain('web.whatsapp.com');
  });
});
