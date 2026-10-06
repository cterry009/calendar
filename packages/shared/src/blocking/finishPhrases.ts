// Lines that push to finish the pomodoro that's running (user-requested, 2026-10-06), shown with
// its countdown: on the phone's overlay and block popup, and on the desktop's card and popup. The
// remaining minutes are part of the line so it's concrete, not a slogan.

const LONG: Array<(m: number) => string> = [
  (m) => `Quedan ${m} minutos. Una cosa a la vez, hasta el final.`,
  (m) => `${m} minutos más de foco y este pomodoro es tuyo.`,
  (m) => `Lo difícil ya empezó. Sostén ${m} minutos y descansas.`,
  (m) => `En ${m} minutos tendrás un pomodoro completo. Vale la pena terminarlo.`,
  (m) => `No hace falta ganas, hace falta seguir ${m} minutos.`,
];

const SHORT: Array<(m: number) => string> = [
  (m) => `Solo ${m} ${m === 1 ? 'minuto' : 'minutos'}. Ya casi.`,
  () => 'Estás en la recta final: termina este pomodoro.',
  (m) => `${m} ${m === 1 ? 'minuto' : 'minutos'} y descansas. No lo sueltes ahora.`,
  () => 'Lo que empezaste está a punto de quedar hecho.',
];

const PAUSED: Array<(m: number) => string> = [
  (m) => `Te faltan ${m} minutos de este pomodoro. Cuando vuelvas, sigue desde ahí.`,
  (m) => `El pomodoro te espera con ${m} minutos. Volver es más fácil que empezar.`,
  () => 'Lo pausaste, no lo perdiste: vuelve y termínalo.',
];

/**
 * A line about finishing the current pomodoro with `remainingMinutes` left (rounded up). `seed`
 * keeps the same line while one phase lasts (pass the session id + cycle) instead of a new one on
 * every render. `paused` picks lines for when the user left the block.
 */
export function finishPomodoroPhrase(remainingMinutes: number, seed = '', paused = false): string {
  const minutes = Math.max(1, Math.ceil(remainingMinutes));
  const pool = paused ? PAUSED : minutes <= 5 ? SHORT : LONG;
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return pool[hash % pool.length](minutes);
}
