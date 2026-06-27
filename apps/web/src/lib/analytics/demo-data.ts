import type { TaskDifficulty, TaskPriority } from '@calendar/shared';
import type { DashboardDemoPayload } from './types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function generateDashboardDemoData(now = new Date()): DashboardDemoPayload {
  const start = startOfDay(new Date(now.getTime() - 13 * MS_PER_DAY));

  const tasks: DashboardDemoPayload['tasks'] = [];
  const pomodoroSessions: DashboardDemoPayload['pomodoroSessions'] = [];
  const fitnessEntries: DashboardDemoPayload['fitnessEntries'] = [];

  for (let index = 0; index < 14; index += 1) {
    const day = new Date(start.getTime() + index * MS_PER_DAY);
    const weekday = day.getDay();
    const inCurrentWeek = index >= 7;
    const exerciseDay = weekday === 1 || weekday === 3 || weekday === 5 || (weekday === 0 && inCurrentWeek);

    const baseTasks = exerciseDay ? 3 : 1;
    const taskCount = baseTasks + (inCurrentWeek ? 1 : 0);

    for (let taskIndex = 0; taskIndex < taskCount; taskIndex += 1) {
      const difficulty = pickDifficulty(taskIndex);
      const estimatedMinutes = pickEstimatedMinutes(difficulty, taskIndex);
      const actualMinutes = pickActualMinutes(estimatedMinutes, difficulty, exerciseDay, inCurrentWeek);
      const completedAt = withTime(day, 9 + taskIndex * 2, 20).toISOString();

      tasks.push({
        clientId: crypto.randomUUID(),
        updatedAt: completedAt,
        title: `Demo tarea ${index + 1}-${taskIndex + 1}`,
        description: exerciseDay ? 'Dia con ejercicio: productividad alta' : 'Dia normal de trabajo',
        scheduledAt: withTime(day, 9 + taskIndex * 2, 0).toISOString(),
        estimatedMinutes,
        actualMinutes,
        difficulty,
        complexity: difficulty === 'HARD' ? 8 : difficulty === 'MEDIUM' ? 5 : 3,
        priority: pickPriority(difficulty),
        category: 'Demo dashboard',
        status: 'COMPLETED',
        completedAt,
      });

      const pomodoroCount = difficulty === 'HARD' ? 2 : 1;
      for (let p = 0; p < pomodoroCount; p += 1) {
        const startedAt = withTime(day, 8 + taskIndex * 2, p * 30).toISOString();
        const endedAt = withTime(day, 8 + taskIndex * 2, p * 30 + 25).toISOString();

        pomodoroSessions.push({
          id: crypto.randomUUID(),
          updatedAt: endedAt,
          taskId: undefined,
          state: 'IDLE',
          focusDurationMin: 25,
          shortBreakMin: 5,
          longBreakMin: 15,
          cyclesBeforeLongBreak: 4,
          completedCycles: 1,
          active: false,
          interrupted: false,
          startedAt,
          endedAt,
        });
      }
    }

    if (exerciseDay) {
      fitnessEntries.push({
        updatedAt: withTime(day, 7, 45).toISOString(),
        activityType: weekday === 5 ? 'fuerza' : 'running',
        durationMinutes: inCurrentWeek ? 55 : 40,
        intensity: inCurrentWeek ? 'HIGH' : 'MEDIUM',
        notes: inCurrentWeek ? 'Entrenamiento con buena energia' : 'Sesion consistente',
        loggedAt: withTime(day, 7, 30).toISOString(),
        source: 'MANUAL',
      });
    }
  }

  return {
    tasks,
    pomodoroSessions,
    fitnessEntries,
  };
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function withTime(day: Date, hour: number, minute: number) {
  const value = new Date(day);
  value.setHours(hour, minute, 0, 0);
  return value;
}

function pickDifficulty(index: number): TaskDifficulty {
  if (index % 3 === 0) {
    return 'HARD';
  }
  if (index % 2 === 0) {
    return 'MEDIUM';
  }
  return 'EASY';
}

function pickPriority(difficulty: TaskDifficulty): TaskPriority {
  if (difficulty === 'HARD') {
    return 'HIGH';
  }
  if (difficulty === 'MEDIUM') {
    return 'MEDIUM';
  }
  return 'LOW';
}

function pickEstimatedMinutes(difficulty: TaskDifficulty, index: number): number {
  if (difficulty === 'HARD') {
    return 90 + index * 5;
  }
  if (difficulty === 'MEDIUM') {
    return 60 + index * 5;
  }
  return 35 + index * 5;
}

function pickActualMinutes(
  estimatedMinutes: number,
  difficulty: TaskDifficulty,
  exerciseDay: boolean,
  inCurrentWeek: boolean,
): number {
  const baseFactor = difficulty === 'HARD' ? 1.15 : difficulty === 'MEDIUM' ? 1.05 : 0.95;
  const fitnessFactor = exerciseDay ? 0.92 : 1.08;
  const trendFactor = inCurrentWeek ? 0.94 : 1;
  return Math.max(20, Math.round(estimatedMinutes * baseFactor * fitnessFactor * trendFactor));
}
