import { JOG_ACTIVITY_TYPE } from '../activityRecognition/api';
import type { HabitFormValues } from './types';

// Task 11.7: the six specific daily habits requested, seeded as one-tap quick-add templates now
// that reminder-time fields exist (task 11.5) -- each sets the actual reminder window described,
// not just a prefilled generic form (which is what would make "quick add" pointless).
export interface HabitTemplate {
  id: string;
  label: string;
  values: HabitFormValues;
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function template(overrides: Partial<HabitFormValues> & Pick<HabitFormValues, 'title'>): HabitFormValues {
  return {
    description: null,
    type: 'NORMAL',
    dailyGoalValue: 1,
    dailyGoalUnit: 'vez',
    dailyGoalExtraValue: null,
    targetDays: 66,
    color: null,
    category: null,
    linkedFitnessActivityType: null,
    reminderDaysOfWeek: ALL_DAYS,
    ...overrides,
  };
}

export const HABIT_TEMPLATES: HabitTemplate[] = [
  {
    id: 'wake-up',
    label: 'Despertarse antes de las 7',
    values: template({
      title: 'Despertarse antes de las 7',
      category: 'Rutina matutina',
      reminderEndMinute: 7 * 60,
    }),
  },
  {
    id: 'get-ready',
    label: 'Arreglarse (7-8am)',
    values: template({
      title: 'Arreglarse',
      category: 'Rutina matutina',
      reminderStartMinute: 7 * 60,
      reminderEndMinute: 8 * 60,
    }),
  },
  {
    id: 'sport',
    label: 'Deporte / trotar',
    values: template({
      title: 'Deporte / trotar',
      category: 'Salud',
      // Links to the native jog-detection auto-complete path (task 11.2/11.7) -- the reminder
      // below only fires if 20:00 arrives and the day still isn't auto-completed.
      linkedFitnessActivityType: JOG_ACTIVITY_TYPE,
      reminderEndMinute: 20 * 60,
    }),
  },
  {
    id: 'dog-walk',
    label: 'Sacar al perro',
    values: template({
      title: 'Sacar al perro',
      category: 'Rutina',
      reminderEndMinute: 19 * 60,
    }),
  },
  {
    id: 'work-hours',
    label: 'Horario de trabajo',
    values: template({
      title: 'Horario de trabajo',
      category: 'Trabajo',
      // No default reminder time -- work hours vary per person, and this app already has a real
      // WORK Schedule concept (lib/calendar/types.ts's SyncScheduleRecord) that isn't linked to
      // habits yet (a stated stretch goal, not silently skipped -- see design.md). Manual
      // check-in from the list until that link exists.
    }),
  },
  {
    id: 'study-hours',
    label: 'Horario de estudio',
    values: template({
      title: 'Horario de estudio',
      category: 'Estudio',
    }),
  },
  {
    id: 'socialize',
    label: 'Socializar',
    values: template({
      title: 'Socializar',
      category: 'Bienestar',
      // No reminder at all -- the user themselves was unsure this belongs on a timer. Available
      // as a habit, not prescribed with a schedule.
    }),
  },
];
