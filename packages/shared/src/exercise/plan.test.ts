import { PRESCRIPTION } from './prescription.js';
import { exerciseWeek, morningExerciseFor, morningExerciseQuestion, nextRoutineDay, plannedMinutes } from './plan.js';

const START = '2026-11-09'; // a Monday

describe('prescription', () => {
  it('has five days, each with the four phases and YouTube links', () => {
    expect(PRESCRIPTION.dias.map((d) => d.day)).toEqual([1, 2, 3, 4, 5]);
    for (const day of PRESCRIPTION.dias) {
      expect(day.videos.map((x) => x.phase).sort()).toEqual(['aerobico', 'calentamiento', 'estiramiento', 'fuerza']);
      for (const video of day.videos) expect(video.url).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/);
    }
  });
});

describe('morning plan', () => {
  it('routine Mon/Wed/Fri, jog Tue/Thu, optional mobility Saturday, Sunday rest', () => {
    const week = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'];
    expect(week.map((d) => morningExerciseFor(d, START, 0).kind)).toEqual([
      'rutina', 'trote', 'rutina', 'trote', 'rutina', 'movilidad', 'descanso',
    ]);
    expect(morningExerciseFor('2026-11-14', START, 0).optional).toBe(true);
    expect(morningExerciseFor('2026-11-15', START, 0).plannedMinutes).toBe(0);
  });

  it('a skipped Monday does not skip a routine day', () => {
    // Día 1 done the week before, Monday skipped: Wednesday is still Día 2.
    expect(morningExerciseFor('2026-11-18', START, 1).routine?.day).toBe(2);
    expect(nextRoutineDay(5).day).toBe(1);
  });

  it('lengths follow the progression: 45 in weeks 1-2, +5 per week up to 60; jogs capped at 30', () => {
    expect([1, 2, 3, 4, 5, 8].map((w) => plannedMinutes('rutina', w))).toEqual([45, 45, 50, 55, 60, 60]);
    expect([1, 2, 3, 4, 6].map((w) => plannedMinutes('trote', w))).toEqual([20, 20, 25, 30, 30]);
    expect(exerciseWeek(START, '2026-11-30')).toBe(4);
    expect(morningExerciseFor('2026-11-30', START, 9).plannedMinutes).toBe(55);
  });

  it('light intensity the first two weeks, then moderate', () => {
    expect(morningExerciseFor('2026-11-20', START, 0).intensity).toBe('leve');
    expect(morningExerciseFor('2026-11-23', START, 0).intensity).toBe('moderada');
  });

  it('asks by day', () => {
    expect(morningExerciseQuestion(morningExerciseFor('2026-11-11', START, 0))).toBe('¿Ya hiciste los ejercicios básicos?');
    expect(morningExerciseQuestion(morningExerciseFor('2026-11-12', START, 0))).toBe('¿Ya saliste a trotar?');
  });
});
