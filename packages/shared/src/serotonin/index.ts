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
  meditation: 'Meditación',
  journaling: 'Diario / Gratitud',
  social: 'Conexión social',
  exercise: 'Ejercicio',
};

export const SEROTONIN_RITUALS = [
  'breathing',
  'gratitude',
  'stretch',
  'sunlight',
  'digital_pause',
] as const;

export type SerotoninRitual = (typeof SEROTONIN_RITUALS)[number];

export const RITUAL_LABELS: Record<SerotoninRitual, { title: string; durationMin: number; description: string }> = {
  breathing: {
    title: 'Respiración 4-7-8',
    durationMin: 3,
    description: 'Inhala 4s, retén 7s, exhala 8s. Repite 4 ciclos.',
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
    title: 'Exposición a luz',
    durationMin: 5,
    description: 'Sal al exterior o siéntate junto a una ventana con luz natural 15–20 min.',
  },
  digital_pause: {
    title: 'Pausa digital',
    durationMin: 5,
    description: 'Deja el dispositivo boca abajo y observa tu entorno sin estímulos.',
  },
};

export const MOOD_STATES = ['calm', 'anxious', 'low_energy', 'grateful', 'restless'] as const;

export type MoodState = (typeof MOOD_STATES)[number];

export const MOOD_LABELS: Record<MoodState, string> = {
  calm: 'Tranquilo',
  anxious: 'Ansioso',
  low_energy: 'Sin energía',
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
  score: number;
}

export interface SerotoninScoreInput {
  pillars: PillarProgress[];
  completedRituals: SerotoninRitual[];
  moodCheckIns: { mood: MoodState }[];
  screenTimeReductionPercent?: number;
}

/** Pillar completion contributes up to 60 points (10 per pillar). */
export function calculateSerotoninScore(input: SerotoninScoreInput): number {
  const pillarPoints =
    (input.pillars.filter((p) => p.completed).length / SEROTONIN_PILLARS.length) * 60;
  const ritualPoints = Math.min(input.completedRituals.length * 8, 24);
  const moodPoints = input.moodCheckIns.some((m) => m.mood === 'calm' || m.mood === 'grateful')
    ? 10
    : input.moodCheckIns.length > 0
      ? 5
      : 0;
  const screenPoints = Math.min((input.screenTimeReductionPercent ?? 0) * 0.06, 6);
  return Math.round(Math.min(100, pillarPoints + ritualPoints + moodPoints + screenPoints));
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
    const total = p.minutes + minutes;
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

export function endSerotoninSession(session: SerotoninSession): SerotoninSession {
  return {
    ...recalculateSession(session, {}),
    active: false,
    endedAt: new Date().toISOString(),
  };
}

function recalculateSession(
  session: SerotoninSession,
  patch: Partial<Pick<SerotoninSession, 'pillars' | 'completedRituals' | 'moodCheckIns'>>,
): SerotoninSession {
  const pillars = patch.pillars ?? session.pillars;
  const completedRituals = patch.completedRituals ?? session.completedRituals;
  const moodCheckIns = patch.moodCheckIns ?? session.moodCheckIns;
  const score = calculateSerotoninScore({ pillars, completedRituals, moodCheckIns });
  return { ...session, pillars, completedRituals, moodCheckIns, score };
}
