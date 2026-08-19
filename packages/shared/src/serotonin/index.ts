/** @see https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2077351/ */
/** @see https://www.health.harvard.edu/mind-and-mood/serotonin-the-natural-mood-booster */

export const SEROTONIN_PILLARS = [
  'outdoors',
  'reading',
  'meditation',
  'journaling',
  'social',
  'exercise',
] as const;

export type SerotoninPillar = (typeof SEROTONIN_PILLARS)[number];

export const PILLAR_LABELS: Record<SerotoninPillar, string> = {
  outdoors: 'Aire libre / Luz solar',
  reading: 'Lectura',
  meditation: 'MeditaciÃ³n',
  journaling: 'Diario / Gratitud',
  social: 'ConexiÃ³n social',
  exercise: 'Ejercicio',
};

export const SEROTONIN_RITUALS = [
  'breathing',
  'gratitude',
  'stretch',
  'sunlight',
  'digital_pause',
  'morning_review',
  'evening_shutdown',
] as const;

export type SerotoninRitual = (typeof SEROTONIN_RITUALS)[number];

export const RITUAL_LABELS: Record<SerotoninRitual, { title: string; durationMin: number; description: string }> = {
  breathing: {
    title: 'RespiraciÃ³n 4-7-8',
    durationMin: 3,
    description: 'Inhala 4s, retÃ©n 7s, exhala 8s. Repite 4 ciclos.',
  },
  gratitude: {
    title: 'Nota de gratitud',
    durationMin: 2,
    description: 'Escribe una cosa concreta por la que te sientes agradecido hoy.',
  },
  stretch: {
    title: 'Estiramiento suave',
    durationMin: 5,
    description: 'Estira cuello, hombros y espalda sin pantallas.',
  },
  sunlight: {
    title: 'ExposiciÃ³n a luz',
    durationMin: 5,
    description: 'Sal al exterior o siÃ©ntate junto a una ventana con luz natural 15â€“20 min.',
  },
  digital_pause: {
    title: 'Pausa digital',
    durationMin: 5,
    description: 'Deja el dispositivo boca abajo y observa tu entorno sin estÃ­mulos.',
  },
  morning_review: {
    title: 'RevisiÃ³n matutina',
    durationMin: 5,
    description: 'Revisa las tareas de hoy y las pendientes de ayer, y dales un horario concreto.',
  },
  evening_shutdown: {
    title: 'Cierre nocturno',
    durationMin: 5,
    description: 'Marca lo que completaste, posterga lo que no, y anota una reflexiÃ³n corta.',
  },
};

export const MOOD_STATES = ['calm', 'anxious', 'low_energy', 'grateful', 'restless'] as const;

export type MoodState = (typeof MOOD_STATES)[number];

export const MOOD_LABELS: Record<MoodState, string> = {
  calm: 'Tranquilo',
  anxious: 'Ansioso',
  low_energy: 'Sin energÃ­a',
  grateful: 'Agradecido',
  restless: 'Inquieto',
};

export interface PillarProgress {
  pillar: SerotoninPillar;
  minutes: number;
  targetMinutes: number;
  completed: boolean;
}

export interface SerotoninSession {
  id: string;
  active: boolean;
  startedAt: string;
  endedAt?: string;
  pillars: PillarProgress[];
  completedRituals: SerotoninRitual[];
  moodCheckIns: { at: string; mood: MoodState }[];
  /** Times the user declined to leave an active block/focus session -- a real proxy for "blocked-app opens declined" in a web app with no OS-level app interception. */
  temptationsAvoided: number;
  score: number;
}

export interface SerotoninScoreInput {
  pillars: PillarProgress[];
  completedRituals: SerotoninRitual[];
  moodCheckIns: { mood: MoodState }[];
  temptationsAvoided?: number;
  screenTimeReductionPercent?: number;
}

/**
 * Pillar completion contributes up to 50 points (was 60 before task 5.9 introduced
 * temptationsAvoided as its own scored dimension -- rebalanced so quality-of-screen-time signals
 * carry real weight instead of being drowned out by activity minutes alone).
 */
export function calculateSerotoninScore(input: SerotoninScoreInput): number {
  const pillarPoints =
    (input.pillars.filter((p) => p.completed).length / SEROTONIN_PILLARS.length) * 50;
  const ritualPoints = Math.min(input.completedRituals.length * 8, 24);
  const moodPoints = input.moodCheckIns.some((m) => m.mood === 'calm' || m.mood === 'grateful')
    ? 10
    : input.moodCheckIns.length > 0
      ? 5
      : 0;
  const temptationPoints = Math.min((input.temptationsAvoided ?? 0) * 2, 10);
  const screenPoints = Math.min((input.screenTimeReductionPercent ?? 0) * 0.06, 6);
  return Math.round(
    Math.min(100, pillarPoints + ritualPoints + moodPoints + temptationPoints + screenPoints),
  );
}

export function createDefaultPillars(targetMinutes = 15): PillarProgress[] {
  return SEROTONIN_PILLARS.map((pillar) => ({
    pillar,
    minutes: 0,
    targetMinutes,
    completed: false,
  }));
}

export function updatePillarMinutes(
  pillars: PillarProgress[],
  pillar: SerotoninPillar,
  minutes: number,
): PillarProgress[] {
  return pillars.map((p) => {
    if (p.pillar !== pillar) return p;
    const total = Math.max(0, p.minutes + minutes);
    return {
      ...p,
      minutes: total,
      completed: total >= p.targetMinutes,
    };
  });
}

export function suggestNextPillar(pillars: PillarProgress[]): SerotoninPillar | null {
  const incomplete = pillars.filter((p) => !p.completed);
  if (incomplete.length === 0) return null;
  const priority: SerotoninPillar[] = ['outdoors', 'exercise', 'meditation', 'social', 'reading', 'journaling'];
  return priority.find((p) => incomplete.some((i) => i.pillar === p)) ?? incomplete[0].pillar;
}

export function suggestNextRitual(completed: SerotoninRitual[]): SerotoninRitual | null {
  return SEROTONIN_RITUALS.find((r) => !completed.includes(r)) ?? null;
}

export function createSerotoninSession(id: string): SerotoninSession {
  const pillars = createDefaultPillars();
  return {
    id,
    active: true,
    startedAt: new Date().toISOString(),
    pillars,
    completedRituals: [],
    moodCheckIns: [],
    temptationsAvoided: 0,
    score: 0,
  };
}

export function completeRitual(
  session: SerotoninSession,
  ritual: SerotoninRitual,
): SerotoninSession {
  if (session.completedRituals.includes(ritual)) return session;
  const completedRituals = [...session.completedRituals, ritual];
  return recalculateSession(session, { completedRituals });
}

export function logPillarActivity(
  session: SerotoninSession,
  pillar: SerotoninPillar,
  minutes: number,
): SerotoninSession {
  const pillars = updatePillarMinutes(session.pillars, pillar, minutes);
  return recalculateSession(session, { pillars });
}

export function logMood(session: SerotoninSession, mood: MoodState): SerotoninSession {
  const moodCheckIns = [...session.moodCheckIns, { at: new Date().toISOString(), mood }];
  return recalculateSession(session, { moodCheckIns });
}

/** Call when the user declines to leave an active block/focus session (e.g. cancels the exit friction pause). */
export function recordTemptationAvoided(session: SerotoninSession): SerotoninSession {
  return recalculateSession(session, { temptationsAvoided: session.temptationsAvoided + 1 });
}

export function endSerotoninSession(session: SerotoninSession): SerotoninSession {
  return {
    ...recalculateSession(session, {}),
    active: false,
    endedAt: new Date().toISOString(),
  };
}

function recalculateSession(
  session: SerotoninSession,
  patch: Partial<Pick<SerotoninSession, 'pillars' | 'completedRituals' | 'moodCheckIns' | 'temptationsAvoided'>>,
): SerotoninSession {
  const pillars = patch.pillars ?? session.pillars;
  const completedRituals = patch.completedRituals ?? session.completedRituals;
  const moodCheckIns = patch.moodCheckIns ?? session.moodCheckIns;
  const temptationsAvoided = patch.temptationsAvoided ?? session.temptationsAvoided;
  const score = calculateSerotoninScore({ pillars, completedRituals, moodCheckIns, temptationsAvoided });
  return { ...session, pillars, completedRituals, moodCheckIns, temptationsAvoided, score };
}

