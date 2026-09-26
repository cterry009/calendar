// Desktop counterpart of apps/mobile/src/lib/nightBlock/state.ts's window math. Deliberately a
// separate, small, pure implementation rather than sharing mobile's module: that one has real
// native-storage/pub-sub machinery entangled with the pure time math, entangled with a native
// bridge this platform doesn't have. The actual math (is `now` inside a possibly-midnight-
// wrapping window) is simple enough that duplicating it is safer than forcing a refactor of
// mobile's working code.
//
// Fixed at the same 22:30-08:00 default mobile originally shipped (task 11.9) -- not yet
// user-configurable on desktop (mobile only gained that later, task 11.22); a NIGHT-scoped
// block-list entry here always uses this default window.
export const DEFAULT_NIGHT_START_MINUTES = 22 * 60 + 30;
export const DEFAULT_NIGHT_END_MINUTES = 8 * 60;

export function formatNightWindowMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function isWithinNightWindow(
  date: Date,
  startMinutes = DEFAULT_NIGHT_START_MINUTES,
  endMinutes = DEFAULT_NIGHT_END_MINUTES,
): boolean {
  const minutesNow = date.getHours() * 60 + date.getMinutes();
  if (startMinutes === endMinutes) return false;
  if (startMinutes < endMinutes) {
    return minutesNow >= startMinutes && minutesNow < endMinutes;
  }
  // Window wraps midnight (e.g. 22:30 -> 08:00).
  return minutesNow >= startMinutes || minutesNow < endMinutes;
}
