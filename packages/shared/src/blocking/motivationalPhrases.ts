// User-requested: while a focus session is genuinely running (not someone trying to exit it), the
// persistent reminder should reinforce staying with it, not just list distractors to avoid. Since
// 2026-10-01 they're about three things the user asked for: effort, concentration and motivation.

const EFFORT = [
  'El esfuerzo de ahora es el que se nota después.',
  'Lo difícil de esta parte es justo lo que te hace avanzar.',
  'No hace falta que sea fácil. Hace falta que lo sigas intentando.',
  'Cada pomodoro terminado es esfuerzo que ya nadie te quita.',
  'Cuesta porque estás aprendiendo algo nuevo. Así se siente crecer.',
  'Un poco más de esfuerzo y cierras este bloque.',
  'La constancia le gana al talento que no se esfuerza.',
];

const CONCENTRATION = [
  'Una sola tarea. Esta es la que importa ahora.',
  'Si te distraes, vuelve a la última línea que entendiste.',
  'La concentración se entrena, y la estás entrenando ahora mismo.',
  'Piensa solo en el próximo paso, no en todo lo que falta.',
  'Lo que quieres revisar puede esperar hasta la pausa.',
  'Respira y vuelve a la tarea. Ya estás adentro.',
  'Cada minuto de concentración cuenta.',
];

const MOTIVATION = [
  'Recuerda por qué empezaste este bloque.',
  'Lo que construyes hoy es lo que mañana te abre puertas.',
  'Tu yo de mañana te va a agradecer este bloque.',
  'Ya empezaste, y eso era lo más difícil.',
  'Vas mejor de lo que crees. Sigue.',
  'Cada sesión te acerca a la meta, aunque hoy no se note.',
  'Nadie se arrepiente de haber terminado lo que empezó.',
];

const MOTIVATIONAL_PHRASES = [...EFFORT, ...CONCENTRATION, ...MOTIVATION];

export function pickMotivationalPhrase(): string {
  return MOTIVATIONAL_PHRASES[Math.floor(Math.random() * MOTIVATIONAL_PHRASES.length)];
}

/** The full list, for Android's native block popup. */
export function motivationalPhrases(): string[] {
  return [...MOTIVATIONAL_PHRASES];
}
