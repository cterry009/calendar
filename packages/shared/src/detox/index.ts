import type { SerotoninPillar, SerotoninRitual } from '../serotonin/index.js';

export const DETOX_PHASES = [
  'audit',
  'reduction',
  'reintroduction',
  'maintenance',
] as const;

export type DetoxPhase = (typeof DETOX_PHASES)[number];

export interface DetoxChecklistItem {
  id: string;
  label: string;
  required: boolean;
}

export interface DetoxDayPlan {
  day: number;
  phase: DetoxPhase;
  title: string;
  goal: string;
  checklist: DetoxChecklistItem[];
  suggestedRituals: SerotoninRitual[];
  pillarTargets: SerotoninPillar[];
}

export interface BaselineAudit {
  screenTimeHoursEstimate: number;
  topDistractions: string[];
  completedAt: string;
}

export interface DetoxPlan {
  id: string;
  startedAt: string;
  durationDays: number;
  currentDay: number;
  completedDays: number[];
  completedChecklistItems: Record<number, string[]>;
  baselineAudit?: BaselineAudit;
  progressPercent: number;
}

export const DEFAULT_DETOX_DURATION_DAYS = 7;

const DAY_TEMPLATES: Omit<DetoxDayPlan, 'day'>[] = [
  {
    phase: 'audit',
    title: 'Auditoría base',
    goal: 'Identifica tus principales estímulos de alta dopamina y tu tiempo de pantalla habitual.',
    checklist: [
      { id: 'audit-screen-time', label: 'Estimar horas diarias de pantalla', required: true },
      { id: 'audit-distractions', label: 'Listar 2–3 apps o sitios más distractivos', required: true },
      { id: 'audit-mood', label: 'Registrar ánimo inicial', required: true },
    ],
    suggestedRituals: ['digital_pause', 'breathing'],
    pillarTargets: ['outdoors', 'journaling'],
  },
  {
    phase: 'reduction',
    title: 'Reducción selectiva I',
    goal: 'Reduce el uso del primer estímulo identificado durante ventanas de foco.',
    checklist: [
      { id: 'reduce-top-1', label: 'Evitar el estímulo #1 durante 2 horas de foco', required: true },
      { id: 'reduce-ritual', label: 'Completar un ritual de pausa digital', required: true },
      { id: 'reduce-pillar', label: 'Completar un pilar de presencia', required: true },
    ],
    suggestedRituals: ['digital_pause', 'sunlight'],
    pillarTargets: ['outdoors', 'meditation'],
  },
  {
    phase: 'reduction',
    title: 'Reducción selectiva II',
    goal: 'Aplica la misma reducción al segundo estímulo de la lista.',
    checklist: [
      { id: 'reduce-top-2', label: 'Evitar el estímulo #2 en la tarde', required: true },
      { id: 'reduce-block', label: 'Activar bloqueo de distracciones 60 min', required: true },
      { id: 'reduce-social', label: 'Sustituir por conexión social o lectura', required: true },
    ],
    suggestedRituals: ['gratitude', 'stretch'],
    pillarTargets: ['reading', 'social'],
  },
  {
    phase: 'reduction',
    title: 'Reducción selectiva III',
    goal: 'Consolida límites en los 2–3 estímulos principales sin abstinencia total.',
    checklist: [
      { id: 'reduce-top-3', label: 'Limitar el estímulo #3 a una ventana de 30 min', required: true },
      { id: 'reduce-evening', label: 'Sin pantallas de alta dopamina 1h antes de dormir', required: true },
      { id: 'reduce-exercise', label: 'Registrar 20 min de ejercicio o movimiento', required: true },
    ],
    suggestedRituals: ['stretch', 'breathing'],
    pillarTargets: ['exercise', 'meditation'],
  },
  {
    phase: 'reintroduction',
    title: 'Reintroducción con límites',
    goal: 'Vuelve a usar estímulos reducidos solo en ventanas planificadas.',
    checklist: [
      { id: 'reintro-window', label: 'Definir ventana permitida para estímulo #1', required: true },
      { id: 'reintro-check', label: 'Evaluar ánimo antes y después del uso', required: true },
      { id: 'reintro-journal', label: 'Anotar cómo te sentiste tras la ventana', required: true },
    ],
    suggestedRituals: ['gratitude', 'digital_pause'],
    pillarTargets: ['journaling', 'social'],
  },
  {
    phase: 'reintroduction',
    title: 'Consolidación de límites',
    goal: 'Mantén las ventanas acordadas y refuerza hábitos calmantes.',
    checklist: [
      { id: 'reintro-keep', label: 'Respetar ventanas planificadas sin excederte', required: true },
      { id: 'reintro-ritual', label: 'Completar 2 rituales serotoninérgicos', required: true },
      { id: 'reintro-pillars', label: 'Completar 3 pilares de presencia', required: true },
    ],
    suggestedRituals: ['sunlight', 'breathing', 'stretch'],
    pillarTargets: ['outdoors', 'reading', 'meditation'],
  },
  {
    phase: 'maintenance',
    title: 'Mantenimiento y modo serotonina',
    goal: 'Conecta el plan con el Modo Control de Serotonina para sostener el hábito.',
    checklist: [
      { id: 'maint-serotonin', label: 'Activar Modo Serotonina al menos una vez', required: true },
      { id: 'maint-review', label: 'Revisar progreso y ajustar límites personales', required: true },
      { id: 'maint-plan', label: 'Definir rutina semanal de mantenimiento', required: true },
    ],
    suggestedRituals: ['gratitude', 'digital_pause', 'sunlight'],
    pillarTargets: ['outdoors', 'exercise', 'social'],
  },
];

export function createDetoxPlan(
  id: string,
  durationDays: number = DEFAULT_DETOX_DURATION_DAYS,
): DetoxPlan {
  return {
    id,
    startedAt: new Date().toISOString(),
    durationDays,
    currentDay: 1,
    completedDays: [],
    completedChecklistItems: {},
    progressPercent: 0,
  };
}

export function completeBaselineAudit(
  plan: DetoxPlan,
  audit: Omit<BaselineAudit, 'completedAt'>,
): DetoxPlan {
  return recalculateProgress({
    ...plan,
    baselineAudit: {
      ...audit,
      completedAt: new Date().toISOString(),
    },
  });
}

export function getDetoxDayPlan(plan: DetoxPlan, day = plan.currentDay): DetoxDayPlan | null {
  if (day < 1 || day > plan.durationDays) {
    return null;
  }

  const template = DAY_TEMPLATES[Math.min(day - 1, DAY_TEMPLATES.length - 1)];
  return {
    day,
    ...template,
  };
}

export function toggleDetoxChecklistItem(
  plan: DetoxPlan,
  day: number,
  itemId: string,
): DetoxPlan {
  const dayPlan = getDetoxDayPlan(plan, day);
  if (!dayPlan) {
    return plan;
  }

  const current = new Set(plan.completedChecklistItems[day] ?? []);
  if (current.has(itemId)) {
    current.delete(itemId);
  } else {
    current.add(itemId);
  }

  return recalculateProgress({
    ...plan,
    completedChecklistItems: {
      ...plan.completedChecklistItems,
      [day]: [...current],
    },
  });
}

export function isDetoxDayComplete(plan: DetoxPlan, day: number): boolean {
  const dayPlan = getDetoxDayPlan(plan, day);
  if (!dayPlan) {
    return false;
  }

  const completed = new Set(plan.completedChecklistItems[day] ?? []);
  return dayPlan.checklist
    .filter((item) => item.required)
    .every((item) => completed.has(item.id));
}

export function completeDetoxDay(plan: DetoxPlan, day: number): DetoxPlan {
  if (!isDetoxDayComplete(plan, day)) {
    return plan;
  }

  const completedDays = plan.completedDays.includes(day)
    ? plan.completedDays
    : [...plan.completedDays, day].sort((a, b) => a - b);

  const nextDay = Math.min(day + 1, plan.durationDays);

  return recalculateProgress({
    ...plan,
    completedDays,
    currentDay: plan.completedDays.includes(plan.durationDays)
      ? plan.durationDays
      : nextDay,
  });
}

export function calculateDetoxProgress(plan: DetoxPlan): number {
  if (plan.durationDays <= 0) {
    return 0;
  }
  return Math.round((plan.completedDays.length / plan.durationDays) * 100);
}

function recalculateProgress(plan: DetoxPlan): DetoxPlan {
  return {
    ...plan,
    progressPercent: calculateDetoxProgress(plan),
  };
}
