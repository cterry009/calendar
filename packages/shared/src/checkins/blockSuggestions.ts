// 2026-11-10 (the user): a different suggestion for each reason a game or app got blocked, and not the
// same one twice in a row.

export type BlockCause = 'foco' | 'noche' | 'presupuesto-juego' | 'ventana-trabajo' | 'redes';

const BY_CAUSE: Record<BlockCause, readonly string[]> = {
  // In the middle of focused work: bring the stress down, then back to it.
  foco: [
    'Respira 4-4-4-4 (inhala 4, sostén 4, exhala 4, sostén 4) durante un minuto.',
    'Mira la pared o un punto lejano 2 minutos sin hacer nada más.',
    'Exhala largo: 5 respiraciones soltando el aire en el doble de tiempo que lo tomas.',
    'Levántate, estira cuello y hombros 1 minuto y vuelve al pomodoro.',
    'Toma agua despacio y escribe en una línea qué es lo siguiente del bloque.',
  ],
  // Night: wind down for sleep.
  noche: [
    'Lee 15 minutos de un libro (en papel, mejor).',
    'Deja lista la ropa y el desayuno de mañana.',
    'Baja la luz y escucha algo tranquilo 10 minutos.',
    'Escribe tres cosas que salieron bien hoy.',
  ],
  // Used up the work-hours game budget: move and recharge another way.
  'presupuesto-juego': [
    'Saca al perro 10 minutos.',
    'Lee un capítulo corto de algo que te guste.',
    'Camina 10 minutos afuera, sin el celular.',
    'Toma agua y come algo liviano; a veces la falta de energía es hambre.',
    'Haz 10 sentadillas y 10 flexiones de pared para despertar el cuerpo.',
  ],
  // Inside the work window but between blocks.
  'ventana-trabajo': [
    'Sal a la ventana o al patio 5 minutos y respira.',
    'Saca al perro una vuelta corta.',
    'Prepara un café o té y elige la primera tarea del próximo bloque.',
  ],
  redes: [
    'Escribe a alguien en persona o llama en vez de abrir el feed.',
    'Mira la pared 2 minutos: el impulso pasa solo.',
    'Lee 5 páginas de un libro.',
  ],
};

/** A suggestion for the cause, different from the last one shown when possible. */
export function blockSuggestion(cause: BlockCause, last: string | null, random: () => number = Math.random): string {
  const list = BY_CAUSE[cause];
  const pool = list.length > 1 ? list.filter((s) => s !== last) : list;
  return pool[Math.floor(random() * pool.length)];
}

/** The cause to answer for, most specific first. */
export function primaryCause(flags: {
  night: boolean;
  focus: boolean;
  gameBudgetSpent: boolean;
  workWindow: boolean;
  social: boolean;
}): BlockCause {
  if (flags.night) return 'noche';
  if (flags.focus) return 'foco';
  if (flags.gameBudgetSpent) return 'presupuesto-juego';
  if (flags.social) return 'redes';
  return 'ventana-trabajo';
}
