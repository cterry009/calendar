export interface DailyProductivityRecord {
  date: string;
  tasksCompleted: number;
  pomodorosCompleted: number;
}

export interface DailyFitnessRecord {
  date: string;
  exerciseMinutes: number;
}

export interface FitnessCorrelationReport {
  sampleDays: number;
  exerciseDays: number;
  restDays: number;
  avgTasksOnExerciseDays: number;
  avgTasksOnRestDays: number;
  avgPomodorosOnExerciseDays: number;
  avgPomodorosOnRestDays: number;
  taskCompletionLiftPct: number;
  pomodoroLiftPct: number;
  insight: 'positive' | 'neutral' | 'insufficient_data';
  message: string;
}

const MIN_SAMPLE_DAYS = 14;

export function calculateFitnessProductivityCorrelation(
  productivity: DailyProductivityRecord[],
  fitness: DailyFitnessRecord[],
): FitnessCorrelationReport {
  const fitnessByDate = new Map(fitness.map((entry) => [entry.date, entry]));
  const merged = productivity
    .map((day) => ({
      ...day,
      exerciseMinutes: fitnessByDate.get(day.date)?.exerciseMinutes ?? 0,
    }))
    .filter((day) => day.date);

  if (merged.length < MIN_SAMPLE_DAYS) {
    return emptyReport('insufficient_data', merged.length);
  }

  const exerciseDays = merged.filter((day) => day.exerciseMinutes > 0);
  const restDays = merged.filter((day) => day.exerciseMinutes === 0);

  if (exerciseDays.length === 0 || restDays.length === 0) {
    return emptyReport('insufficient_data', merged.length);
  }

  const avgTasksOnExerciseDays = average(exerciseDays.map((day) => day.tasksCompleted));
  const avgTasksOnRestDays = average(restDays.map((day) => day.tasksCompleted));
  const avgPomodorosOnExerciseDays = average(exerciseDays.map((day) => day.pomodorosCompleted));
  const avgPomodorosOnRestDays = average(restDays.map((day) => day.pomodorosCompleted));

  const taskCompletionLiftPct = percentLift(
    avgTasksOnRestDays,
    avgTasksOnExerciseDays,
  );
  const pomodoroLiftPct = percentLift(
    avgPomodorosOnRestDays,
    avgPomodorosOnExerciseDays,
  );

  const insight =
    taskCompletionLiftPct >= 5 || pomodoroLiftPct >= 5 ? 'positive' : 'neutral';

  const message =
    insight === 'positive'
      ? `Los días con ejercicio completas un ${Math.max(taskCompletionLiftPct, 0)}% más tareas de media. Mantener actividad física parece ayudarte a ser más productivo.`
      : 'Aún no hay una correlación clara entre ejercicio y productividad en tus datos recientes.';

  return {
    sampleDays: merged.length,
    exerciseDays: exerciseDays.length,
    restDays: restDays.length,
    avgTasksOnExerciseDays: round(avgTasksOnExerciseDays),
    avgTasksOnRestDays: round(avgTasksOnRestDays),
    avgPomodorosOnExerciseDays: round(avgPomodorosOnExerciseDays),
    avgPomodorosOnRestDays: round(avgPomodorosOnRestDays),
    taskCompletionLiftPct: round(taskCompletionLiftPct),
    pomodoroLiftPct: round(pomodoroLiftPct),
    insight,
    message,
  };
}

function emptyReport(
  insight: FitnessCorrelationReport['insight'],
  sampleDays: number,
): FitnessCorrelationReport {
  return {
    sampleDays,
    exerciseDays: 0,
    restDays: 0,
    avgTasksOnExerciseDays: 0,
    avgTasksOnRestDays: 0,
    avgPomodorosOnExerciseDays: 0,
    avgPomodorosOnRestDays: 0,
    taskCompletionLiftPct: 0,
    pomodoroLiftPct: 0,
    insight,
    message:
      insight === 'insufficient_data'
        ? `Se necesitan al menos ${MIN_SAMPLE_DAYS} días con datos de productividad y fitness para calcular la correlación.`
        : 'No hay suficientes días con y sin ejercicio para comparar.',
  };
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentLift(base: number, value: number): number {
  if (base <= 0) {
    return value > 0 ? 100 : 0;
  }
  return ((value - base) / base) * 100;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
