// User-requested: while a focus session is genuinely running (not someone trying to exit it), the
// persistent reminder should reinforce staying with it, not just list distractors to avoid.

const MOTIVATIONAL_PHRASES = [
  'Vas bien. Un paso a la vez.',
  'Cada minuto de enfoque cuenta.',
  'Ya empezaste -- lo mas dificil ya paso.',
  'Segui asi, se nota el progreso.',
  'Tu yo del futuro te va a agradecer esto.',
  'No tiene que ser perfecto, tiene que estar hecho.',
  'Un poco mas y cerras este bloque.',
  'Estas construyendo el habito, no solo la tarea.',
  'La concentracion es un musculo -- lo estas entrenando ahora.',
  'Dale, ya estas adentro. Quedate un rato mas.',
  'Lo que evitas ahora, lo pagas despues con mas estres. Seguila.',
  'Nadie se arrepiente de haber terminado algo.',
  'Enfocate en el proximo minuto, no en todo lo que falta.',
  'Estas mas cerca del final de lo que crees.',
  'La disciplina de hoy es la libertad de mas tarde.',
  'Respira, y volve a la tarea. Vos podes con esto.',
  'El impulso ya esta de tu lado -- no lo cortes ahora.',
  'Una tarea a la vez. Esta es la que importa ahora.',
  'Constancia le gana a la intensidad. Seguí sumando minutos.',
  'Esto tambien es parte de construir la vida que queres.',
];

export function pickMotivationalPhrase(): string {
  return MOTIVATIONAL_PHRASES[Math.floor(Math.random() * MOTIVATIONAL_PHRASES.length)];
}

/** The full list, for Android's native block popup. */
export function motivationalPhrases(): string[] {
  return [...MOTIVATIONAL_PHRASES];
}
