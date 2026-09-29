import { isKnownDistractingApp } from './socialPackages.js';

// "Llevas una hora" warnings, shared by the Windows desktop client and Android so both use the
// same threshold and the same idea of what counts as social -- the same anti-drift reasoning
// socialPackages.ts gives for centralising its own list.
//
// Per category, not per app: twenty minutes in each of three feeds is the same lost hour as sixty
// in one, and only the category total catches that.
export const USAGE_WARNING_THRESHOLD_MINUTES = 60;

export type UsageWarningCategory = 'SOCIAL' | 'GAMES';

export interface UsageWarning {
  category: UsageWarningCategory;
  minutes: number;
}

export interface UsageCategoryTotals {
  socialMinutes: number;
  gameMinutes: number;
}

/** Minutes at which each category was last warned about today; absent = not warned yet. */
export type UsageWarningState = Partial<Record<UsageWarningCategory, number | null>>;

// The nagging gets tighter the longer it goes: one warning at the first hour, then every 30 min,
// every 15 min past the second hour, and every 5 min past the third. The interval is chosen from
// where you already are, so it escalates on its own without a schedule to keep in sync.
export function warningIntervalMinutes(minutes: number): number {
  if (minutes >= 180) return 5;
  if (minutes >= 120) return 15;
  return 30;
}

/** Minute count at which the next warning for a category is due. */
export function nextWarningThreshold(lastWarnedMinutes: number | null | undefined): number {
  if (lastWarnedMinutes == null) return USAGE_WARNING_THRESHOLD_MINUTES;
  return lastWarnedMinutes + warningIntervalMinutes(lastWarnedMinutes);
}

// Dedicated desktop social clients, keyed by lowercased exe name to match app_tracking.rs's keys.
//
// **This list is structurally incomplete on Windows and that is not fixable here.** Desktop social
// media overwhelmingly happens inside a browser tab, and the tracker reads only the process name,
// never the window title -- deliberately, since titles would leak document names and browsing into
// the sync pipeline. So chrome.exe is indistinguishable from chrome.exe. Only standalone clients
// can be attributed, which in practice means this fires rarely on desktop while the GAMES warning
// (backed by game_tracking.rs's registry/process detection) is reliable. Android has no such gap:
// there every app is its own package.
//
// Messaging is excluded on purpose, matching KNOWN_DISTRACTING_PACKAGES' reasoning -- warning
// someone about their primary communication channel would feel wrong more often than right.
const SOCIAL_DESKTOP_EXECUTABLES = new Set([
  'instagram.exe',
  'tiktok.exe',
  'twitter.exe',
  'x.exe',
  'facebook.exe',
  'reddit.exe',
  'pinterest.exe',
  'tumblr.exe',
]);

export function isSocialDesktopApp(exeName: string): boolean {
  return SOCIAL_DESKTOP_EXECUTABLES.has(exeName.toLowerCase());
}

export function sumSocialDesktopMinutes(entries: { key: string; minutes: number }[]): number {
  return entries.reduce(
    (total, entry) => (isSocialDesktopApp(entry.key) ? total + entry.minutes : total),
    0,
  );
}

export function sumSocialMobileMinutes(
  entries: { packageName: string; minutes: number }[],
): number {
  return entries.reduce(
    (total, entry) => (isKnownDistractingApp(entry.packageName) ? total + entry.minutes : total),
    0,
  );
}

// Returns the categories whose next warning is due. `lastWarned` comes from per-platform storage
// (it needs a day key), so reading and writing it stays with the caller and this stays pure.
//
// A caller that records `warning.minutes` -- not the threshold that was crossed -- gets catch-up
// suppression for free: coming back at 200 minutes after a long gap fires once at the current
// level instead of replaying every interval that elapsed while nothing was watching.
export function evaluateUsageWarnings(
  totals: UsageCategoryTotals,
  lastWarned: UsageWarningState = {},
): UsageWarning[] {
  const warnings: UsageWarning[] = [];

  if (totals.socialMinutes >= nextWarningThreshold(lastWarned.SOCIAL)) {
    warnings.push({ category: 'SOCIAL', minutes: totals.socialMinutes });
  }
  if (totals.gameMinutes >= nextWarningThreshold(lastWarned.GAMES)) {
    warnings.push({ category: 'GAMES', minutes: totals.gameMinutes });
  }

  return warnings;
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function usageWarningTitle(category: UsageWarningCategory): string {
  return category === 'SOCIAL' ? 'Una hora en redes sociales' : 'Una hora de juego';
}

export function usageWarningBody(warning: UsageWarning): string {
  const time = formatMinutes(warning.minutes);
  return warning.category === 'SOCIAL'
    ? `Llevas ${time} hoy en redes sociales. Buen momento para cortar.`
    : `Llevas ${time} hoy jugando. Buen momento para cortar.`;
}

// ---- Weekend evenings: no warnings ----
//
// Friday, Saturday and Sunday evenings are free time on purpose, so nothing nags then. The window
// runs past midnight into the small hours of the next day (Saturday, Sunday and Monday before
// 06:00), since 01:00 on a Saturday is still Friday night. Night-mode blocking is separate and
// unaffected -- this only silences the "llevas una hora" warnings.
export const WEEKEND_QUIET_START_MINUTES = 18 * 60;
export const WEEKEND_QUIET_END_MINUTES = 6 * 60;

const QUIET_EVENING_DAYS = new Set([5, 6, 0]); // Fri, Sat, Sun
const QUIET_SMALL_HOURS_DAYS = new Set([6, 0, 1]); // the mornings after them

export function isWeekendEveningQuiet(date: Date): boolean {
  const minutes = date.getHours() * 60 + date.getMinutes();
  const day = date.getDay();
  if (QUIET_EVENING_DAYS.has(day) && minutes >= WEEKEND_QUIET_START_MINUTES) return true;
  return QUIET_SMALL_HOURS_DAYS.has(day) && minutes < WEEKEND_QUIET_END_MINUTES;
}

// An explicit WORK block in the calendar outranks the weekend rule: if you scheduled work on a
// Friday evening, the strict work-hours limit applies there too.
export function shouldSuppressUsageWarnings(date: Date, inWorkHours: boolean): boolean {
  return !inWorkHours && isWeekendEveningQuiet(date);
}

// ---- Work hours: strict game limit (desktop) ----
//
// Inside a WORK block the game warnings stop being advice. The sequence rides the normal
// escalation schedule, so it needs no clock of its own: the warning at 60 min is the usual one,
// the first one due at or past 90 min is the final warning ("the next one closes the game"), and
// the next one after that starts a 5-minute countdown, after which the client kills the game and
// keeps games blocked for the rest of the work block. With the default schedule that is
// 60 -> 90 -> 120 -> closed at 125.
//
// Always a warning before the close, even when you start playing already past 90 minutes: the
// final warning is tracked as its own flag, not inferred from the minute count.
export const WORK_HOURS_FINAL_WARNING_MINUTES = 90;
export const WORK_HOURS_CLOSE_GRACE_MINUTES = 5;

export type GameWarningKind = 'NORMAL' | 'FINAL' | 'CLOSE';

export function classifyGameWarning(
  minutes: number,
  context: { inWorkHours: boolean; finalWarningGiven: boolean },
): GameWarningKind {
  if (!context.inWorkHours) return 'NORMAL';
  if (context.finalWarningGiven) return 'CLOSE';
  return minutes >= WORK_HOURS_FINAL_WARNING_MINUTES ? 'FINAL' : 'NORMAL';
}

export function gameWarningTitle(kind: GameWarningKind): string {
  if (kind === 'FINAL') return 'Último aviso en horario de trabajo';
  if (kind === 'CLOSE') return `El juego se cierra en ${WORK_HOURS_CLOSE_GRACE_MINUTES} minutos`;
  return usageWarningTitle('GAMES');
}

export function gameWarningBody(kind: GameWarningKind, minutes: number): string {
  const time = formatMinutes(minutes);
  if (kind === 'FINAL') {
    return `Llevas ${time} hoy jugando y estás en horario de trabajo. El próximo aviso cierra el juego.`;
  }
  if (kind === 'CLOSE') {
    return `Llevas ${time} hoy jugando. Guarda la partida: en ${WORK_HOURS_CLOSE_GRACE_MINUTES} minutos se cierra y los juegos quedan bloqueados hasta que termine tu horario de trabajo.`;
  }
  return usageWarningBody({ category: 'GAMES', minutes });
}

// The same strict limit applies to social media in work hours (desktop: standalone social clients;
// Android: WorkSocialLimit.kt, which carries the same wording natively).
export function socialLimitWarningTitle(kind: GameWarningKind): string {
  if (kind === 'FINAL') return 'Último aviso en horario de trabajo';
  if (kind === 'CLOSE') return `Las redes sociales se cierran en ${WORK_HOURS_CLOSE_GRACE_MINUTES} minutos`;
  return usageWarningTitle('SOCIAL');
}

export function socialLimitWarningBody(kind: GameWarningKind, minutes: number): string {
  const time = formatMinutes(minutes);
  if (kind === 'FINAL') {
    return `Llevas ${time} hoy en redes sociales y estás en horario de trabajo. El próximo aviso las cierra.`;
  }
  if (kind === 'CLOSE') {
    return `Llevas ${time} hoy en redes sociales. En ${WORK_HOURS_CLOSE_GRACE_MINUTES} minutos se cierran y quedan bloqueadas hasta que termine tu horario de trabajo.`;
  }
  return usageWarningBody({ category: 'SOCIAL', minutes });
}

export function limitWarningTitle(category: UsageWarningCategory, kind: GameWarningKind): string {
  return category === 'GAMES' ? gameWarningTitle(kind) : socialLimitWarningTitle(kind);
}

export function limitWarningBody(category: UsageWarningCategory, kind: GameWarningKind, minutes: number): string {
  return category === 'GAMES' ? gameWarningBody(kind, minutes) : socialLimitWarningBody(kind, minutes);
}
