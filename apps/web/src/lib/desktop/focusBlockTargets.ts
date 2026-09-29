import { SOCIAL_WEBSITE_DOMAINS, socialDesktopExecutables } from '@calendar/shared';

// During a work focus -- a WORK block, a pomodoro focus phase, or a manual focus -- games and social
// media are blocked outright from the first minute, without the user having to list each one.
// This is on top of whatever the block list itself says.

/** Understood by blocking.rs: any game (Steam libraries, Epic/EA installs, known Riot/Battle.net exes). */
export const ALL_GAMES_IDENTIFIER = 'games:*';

export interface FocusBlockTargets {
  processes: string[];
  websites: string[];
}

export function focusBlockTargets(inFocus: boolean): FocusBlockTargets {
  if (!inFocus) return { processes: [], websites: [] };
  return {
    processes: [ALL_GAMES_IDENTIFIER, ...socialDesktopExecutables()],
    websites: [...SOCIAL_WEBSITE_DOMAINS],
  };
}
