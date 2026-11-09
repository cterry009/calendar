// The user's exercise prescription (Medicina del deporte, Universidad El Bosque, October 2026), copied
// from the PDF they gave on 2026-11-08 -- like plan/horario.ts, don't add content here that isn't in
// it. Video titles are only filled where the PDF prints them next to the link; the rest are links
// without a title in the document.

export type ExercisePhase = 'calentamiento' | 'aerobico' | 'fuerza' | 'estiramiento';

export interface PhaseVideo {
  phase: ExercisePhase;
  url: string;
  title: string | null;
}

export interface RoutineDay {
  /** Día 1 to Día 5 of the prescription's table. */
  day: 1 | 2 | 3 | 4 | 5;
  videos: PhaseVideo[];
}

const yt = (id: string) => `https://www.youtube.com/watch?v=${id}`;
const v = (phase: ExercisePhase, id: string, title: string | null = null): PhaseVideo => ({ phase, url: yt(id), title });

export const PRESCRIPTION = {
  objetivos: [
    'Ganancia de masa muscular',
    'Mejorar condición cardiometabólica',
    'Adherencia a estilos de vida saludables',
  ],
  frecuencia: '3 a 5 veces a la semana (5 días a la semana); fuerza mínimo 3 veces a la semana',
  sesion: '45 a 60 minutos',
  estructura: [
    { phase: 'calentamiento' as const, text: 'Movilidad articular, 5 a 10 minutos' },
    {
      phase: 'fuerza' as const,
      text: 'Trabajo según el día; no repetir el mismo grupo muscular entre 24 y 48 horas. Bandas elásticas, ejercicio funcional o mancuernas',
    },
    {
      phase: 'aerobico' as const,
      text: 'Elíptica o ejercicio funcional, sin superar 30 minutos (elíptica o caminadora no más de 15); revisar la frecuencia cardiaca',
    },
    { phase: 'estiramiento' as const, text: 'Todos los días al final de la sesión: 20 segundos por cada ejercicio, espalda recta' },
  ],
  movilidad: 'Calentamiento – movilidad articular: 20 repeticiones; repetir el circuito 2 veces, evitar estiramientos estáticos, apoyo en silla o pared si es necesario',
  piramidal: 'Entrenamiento piramidal: incrementar el peso a medida que aumentan los sets y disminuyen las repeticiones',
  progresion: 'Las primeras dos semanas intensidad leve, e ir incrementando: por semana incrementar 5 minutos',
  fcMaxTeorica: 174, // Tanaka
  intensidad: {
    leve: { lpm: [90, 122] as [number, number], fcMax: '< 70 %', borg: '< 4' },
    moderada: { lpm: [123, 139] as [number, number], fcMax: '70-80 %', borg: '4 a 6' },
    vigorosa: { lpm: [140, 174] as [number, number], fcMax: '> 80 %', borg: '> 7' },
  },
  seguridad:
    'Si presenta dolor o molestia, no continuar con la actividad física e informar al departamento médico.',
  dias: [
    {
      day: 1,
      videos: [
        v('calentamiento', 'D-m0wB31hBc', 'Calentamiento para Hacer Ejercicio - Ejercicios de Calentamiento en Casa'),
        v('aerobico', '9l7BHHzwqJI', 'Ejercicios Para adelgazar En Casa Principiantes'),
        v('fuerza', 'EHc61ZDOAQk', 'Los Mejores 5 Ejercicios para Brazos con Mancuernas en Casa'),
        v('estiramiento', 'HbgtKOXdjFU'),
      ],
    },
    {
      day: 2,
      videos: [
        v('calentamiento', '6zNVoWLJuLY'),
        v('aerobico', '734f_8z8yL4'),
        v('fuerza', '1_DQUY3pMX8'),
        v('estiramiento', 'Fvr7f2a3P0Q'),
      ],
    },
    {
      day: 3,
      videos: [
        v('calentamiento', '6zNVoWLJuLY'),
        v('aerobico', 'V4DfRj9LaQw'),
        v('fuerza', '734f_8z8yL4'),
        v('estiramiento', 'MppT4peiBy8'),
      ],
    },
    {
      day: 4,
      videos: [
        v('calentamiento', 'ztY8A4qeV6g'),
        v('aerobico', '9l7BHHzwqJI'),
        v('fuerza', 'pFhFsZIuHFE'),
        v('estiramiento', 'Uzg_uIKaxpI'),
      ],
    },
    {
      day: 5,
      videos: [
        v('calentamiento', 'D-m0wB31hBc'),
        v('aerobico', 'Z5_1a2Ss6Ek'),
        v('fuerza', 'YuNi7KXKqvM'),
        v(
          'estiramiento',
          'M8xLkOhk9AE',
          'Estiramientos de Piernas: cuadriceps, isquiotibiales, psoas-iliaco, aductores, abductores y gemelos',
        ),
      ],
    },
  ] as RoutineDay[],
} as const;

export const PHASE_ORDER: ExercisePhase[] = ['calentamiento', 'fuerza', 'aerobico', 'estiramiento'];
export const PHASE_NAMES: Record<ExercisePhase, string> = {
  calentamiento: 'Movilidad y calentamiento',
  fuerza: 'Fuerza',
  aerobico: 'Cardio',
  estiramiento: 'Estiramiento',
};
