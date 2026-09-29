import { isKnownDistractingApp } from '../screenTime/socialPackages.js';

// User-requested: when something gets blocked, suggest a concrete alternative instead of just
// saying "no" -- a feed (social media) and a game call for different kinds of replacement
// activity, so this is bucketed rather than one generic list.
export type BlockCategory = 'SOCIAL' | 'GAME' | 'GENERIC';

const SOCIAL_ACTIVITIES = [
  'Lee unas paginas de un libro.',
  'Escribi algo en tu diario o notas.',
  'Mandale un mensaje real a alguien -- una charla, no un scroll.',
  'Mira por la ventana 2 minutos, sin pantalla de por medio.',
  'Ordena algo pequeno cerca tuyo: un cajon, tu escritorio.',
];

const GAME_ACTIVITIES = [
  'Saca a pasear al perro.',
  'Salir a caminar o estirar 5 minutos.',
  'Toma agua y movete un poco.',
  'Hace una tanda corta de flexiones o sentadillas.',
  'Abri una ventana y respira aire fresco un momento.',
];

const GENERIC_ACTIVITIES = [
  'Respira hondo unas cuantas veces.',
  'Toma agua.',
  'Parate y estirate un momento.',
  'Mira algo lejos por 20 segundos para descansar la vista.',
];

const ACTIVITY_SUGGESTIONS: Record<BlockCategory, string[]> = {
  SOCIAL: SOCIAL_ACTIVITIES,
  GAME: GAME_ACTIVITIES,
  GENERIC: GENERIC_ACTIVITIES,
};

export function pickActivitySuggestion(category: BlockCategory): string {
  const options = ACTIVITY_SUGGESTIONS[category];
  return options[Math.floor(Math.random() * options.length)];
}

// Maps a blocked entry to which suggestion bucket applies. WEBSITE blocks are treated as social
// (the block list's website entries are overwhelmingly feeds -- Instagram, X, etc, same
// assumption the "Sugerencias de bloqueo" panels already make); DESKTOP_APP blocks are treated as
// games (that's what desktop app-blocking is for in this app, see task 9.9/9.10's game-time
// tracking); MOBILE_APP checks the same curated social-app list the screen-time suggestions panel
// uses (packages/shared/src/screenTime/socialPackages.ts) since Android also blocks plenty of
// non-social apps.
export function categorizeBlockedEntry(
  kind: 'MOBILE_APP' | 'DESKTOP_APP' | 'WEBSITE',
  identifier: string,
): BlockCategory {
  if (kind === 'WEBSITE') return 'SOCIAL';
  if (kind === 'DESKTOP_APP') return 'GAME';
  if (kind === 'MOBILE_APP') return isKnownDistractingApp(identifier) ? 'SOCIAL' : 'GENERIC';
  return 'GENERIC';
}

/** All suggestions by bucket -- pushed to Android's native block popup, which can't import this. */
export function activitySuggestionsByCategory(): Record<BlockCategory, string[]> {
  return { SOCIAL: [...SOCIAL_ACTIVITIES], GAME: [...GAME_ACTIVITIES], GENERIC: [...GENERIC_ACTIVITIES] };
}
