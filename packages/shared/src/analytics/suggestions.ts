import type { TaskDifficulty } from '../schemas/enums.js';
import type { DifficultyAccuracy } from './estimation-accuracy.js';

export type SuggestionKind =
  | 'underestimation'
  | 'overestimation'
  | 'missing_break'
  | 'pomodoro_interruptions'
  | 'productivity_peak'
  | 'fitness_correlation';

export interface Suggestion {
  kind: SuggestionKind;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
}

export interface PomodoroAnalyticsRecord {
  interrupted: boolean;
  startedAt: string;
  focusMinutes: number;
}

export interface FocusStreakRecord {
  date: string;
  focusMinutes: number;
  breakMinutes: number;
}

export interface ProductivityDayRecord {
  date: string;
  tasksCompleted: number;
  hourOfDay?: number;
}

export interface SuggestionInput {
  estimationByDifficulty?: Partial<Record<TaskDifficulty, DifficultyAccuracy>>;
  pomodoroSessions?: PomodoroAnalyticsRecord[];
  focusStreaks?: FocusStreakRecord[];
  productivityDays?: ProductivityDayRecord[];
  fitnessExerciseDays?: string[];
}

export function generateSuggestions(input: SuggestionInput): Suggestion[] {
  const suggestions: Suggestion[] = [];

  suggestions.push(...buildEstimationSuggestions(input.estimationByDifficulty));
  suggestions.push(...buildBreakSuggestions(input.focusStreaks));
  suggestions.push(...buildPomodoroInterruptionSuggestions(input.pomodoroSessions));
  suggestions.push(...buildProductivityPeakSuggestion(input.productivityDays));

  return suggestions.sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));
}

function buildEstimationSuggestions(
  estimationByDifficulty?: Partial<Record<TaskDifficulty, DifficultyAccuracy>>,
): Suggestion[] {
  if (!estimationByDifficulty) {
    return [];
  }

  const suggestions: Suggestion[] = [];

  for (const difficulty of ['EASY', 'MEDIUM', 'HARD'] as TaskDifficulty[]) {
    const stats = estimationByDifficulty[difficulty];
    if (!stats || stats.count < 5) {
      continue;
    }

    if (stats.tendency === 'underestimate' && stats.avgErrorPct >= 20) {
      suggestions.push({
        kind: 'underestimation',
        title: 'Estimaciones cortas',
        message: `Tus tareas ${difficulty.toLowerCase()} suelen tardar ${Math.abs(stats.avgErrorPct)}% más de lo estimado. Prueba a aumentar el tiempo reservado.`,
        priority: 'high',
      });
    }

    if (stats.tendency === 'overestimate' && stats.avgErrorPct <= -20) {
      suggestions.push({
        kind: 'overestimation',
        title: 'Estimaciones largas',
        message: `Tus tareas ${difficulty.toLowerCase()} suelen terminar antes de lo previsto. Puedes reservar menos tiempo y liberar espacio en el calendario.`,
        priority: 'medium',
      });
    }
  }

  return suggestions;
}

function buildBreakSuggestions(focusStreaks?: FocusStreakRecord[]): Suggestion[] {
  if (!focusStreaks?.length) {
    return [];
  }

  const longFocusDays = focusStreaks.filter(
    (day) => day.focusMinutes >= 90 && day.breakMinutes < 10,
  );

  if (longFocusDays.length === 0) {
    return [];
  }

  return [
    {
      kind: 'missing_break',
      title: 'Descansos insuficientes',
      message:
        'Has acumulado sesiones de foco de 90+ minutos sin pausas registradas. Programa descansos cortos para mantener la energía.',
      priority: 'high',
    },
  ];
}

function buildPomodoroInterruptionSuggestions(
  sessions?: PomodoroAnalyticsRecord[],
): Suggestion[] {
  if (!sessions?.length) {
    return [];
  }

  const byHour = new Map<number, { total: number; interrupted: number }>();

  for (const session of sessions) {
    const hour = new Date(session.startedAt).getHours();
    const bucket = byHour.get(hour) ?? { total: 0, interrupted: 0 };
    bucket.total += 1;
    if (session.interrupted) {
      bucket.interrupted += 1;
    }
    byHour.set(hour, bucket);
  }

  const suggestions: Suggestion[] = [];

  for (const [hour, stats] of byHour.entries()) {
    if (stats.total < 3) {
      continue;
    }
    const interruptionRate = stats.interrupted / stats.total;
    if (interruptionRate > 0.3) {
      suggestions.push({
        kind: 'pomodoro_interruptions',
        title: 'Pomodoros interrumpidos',
        message: `Más del 30% de tus pomodoros alrededor de las ${hour}:00 se interrumpen. Considera bloquear distracciones o mover tareas exigentes a otra franja.`,
        priority: 'medium',
      });
    }
  }

  return suggestions;
}

function buildProductivityPeakSuggestion(
  productivityDays?: ProductivityDayRecord[],
): Suggestion[] {
  if (!productivityDays || productivityDays.length < 14) {
    return [];
  }

  const byHour = new Map<number, number>();

  for (const day of productivityDays) {
    if (day.hourOfDay === undefined) {
      continue;
    }
    byHour.set(day.hourOfDay, (byHour.get(day.hourOfDay) ?? 0) + day.tasksCompleted);
  }

  if (byHour.size === 0) {
    return [];
  }

  const [peakHour, peakCount] = [...byHour.entries()].sort((a, b) => b[1] - a[1])[0];

  return [
    {
      kind: 'productivity_peak',
      title: 'Franja más productiva',
      message: `Tu mayor número de tareas completadas suele concentrarse alrededor de las ${peakHour}:00 (${peakCount} tareas registradas). Reserva esa ventana para trabajo profundo.`,
      priority: 'low',
    },
  ];
}

function priorityRank(priority: Suggestion['priority']): number {
  switch (priority) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    default:
      return 1;
  }
}
