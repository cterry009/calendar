import {
  generateFocusPlan,
  isPlanCategory,
  occurrencesOnDate,
  PLAN_CATEGORY_INFO,
  resolveFocusPlanConfigWith,
  type FocusPlanSegment,
  type ScheduleExceptionLike,
  type StudyPlanData,
} from '@calendar/shared';
import { dateKey, findRecordForDate } from '../habits/today';
import type { SyncHabit, SyncHabitRecord } from '../habits/types';
import type { SyncScheduleCompletion, SyncScheduleRecord, SyncTaskRecord } from './types';

// One day's agenda for the mobile calendar: work/rest blocks (each work block expanded into the
// same pomodoro plan the desktop day grid draws -- the plan math is shared, packages/shared
// focusPlan.ts), habits with a time block, and scheduled tasks. Mirrors apps/web's
// buildEventsForRange + buildDayBars closely enough that both screens show the same day.

const DEFAULT_HABIT_COLOR = '#4ee0a0';
const DEADLINE_BLOCK_MINUTES = 15;

export type AgendaTarget =
  | { kind: 'schedule'; scheduleId: string }
  | { kind: 'habit'; habitId: string; recordId: string | null };

export interface AgendaBlock {
  id: string;
  kind: 'work' | 'rest' | 'habit' | 'task';
  title: string;
  startMinute: number;
  endMinute: number;
  /** Habits: "antes de las 07:00" / "07:00-08:00"; blocks: the time range. */
  when: string;
  color: string;
  done: boolean;
  /** Marked "no puedo hacer este bloque" that day. */
  skipped?: boolean;
  /** What marking it done writes; null for things that can't be marked (tasks are completed in their own screen). */
  target: AgendaTarget | null;
  /** Work blocks only: the pomodoro plan segments, for the grid; a sequence's carry their label. */
  segments: Array<FocusPlanSegment & { label?: string }>;
  /** Horario 2026-10-19: the block's category that day, its phase description, changed only today. */
  category?: string | null;
  description?: string | null;
  isException?: boolean;
}

export function minuteLabel(minute: number): string {
  return `${String(Math.floor(minute / 60) % 24).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

function rangeLabel(start: number, end: number): string {
  return `${minuteLabel(start)} - ${minuteLabel(end)}`;
}

export function buildDayAgenda(
  date: Date,
  data: {
    schedules: SyncScheduleRecord[];
    habits: SyncHabit[];
    habitRecords: SyncHabitRecord[];
    scheduleCompletions: SyncScheduleCompletion[];
    tasks: SyncTaskRecord[];
    exceptions?: ScheduleExceptionLike[];
    plan?: StudyPlanData | null;
  },
): AgendaBlock[] {
  const day = date.getDay();
  const key = dateKey(date);
  const dayMarks = data.scheduleCompletions.filter((c) => dateKey(c.date) === key);
  const doneSchedules = new Set(dayMarks.filter((c) => (c.status ?? 'DONE') === 'DONE').map((c) => c.scheduleId));
  const skippedSchedules = new Set(dayMarks.filter((c) => c.status === 'SKIPPED').map((c) => c.scheduleId));

  const blocks: AgendaBlock[] = [];

  // Horario 2026-10-19: the template plus that day's exceptions (shared occurrencesOnDate, the
  // same the desktop calendar uses), with the phase's description and the block's own sequence.
  const byId = new Map(data.schedules.map((schedule) => [schedule.id, schedule]));
  for (const occurrence of occurrencesOnDate(data.schedules, data.exceptions ?? [], data.plan ?? null, key)) {
    const schedule = byId.get(occurrence.scheduleId)!;
    const isWork = schedule.kind === 'WORK';
    const categoryColor = isPlanCategory(occurrence.category) ? PLAN_CATEGORY_INFO[occurrence.category].color : null;
    blocks.push({
      id: `schedule-${schedule.id}`,
      kind: isWork ? 'work' : 'rest',
      title: occurrence.title.trim() || (isWork ? 'Bloque de trabajo' : 'Descanso'),
      startMinute: occurrence.startMinute,
      endMinute: occurrence.endMinute,
      when: rangeLabel(occurrence.startMinute, occurrence.endMinute),
      color: categoryColor ?? (isWork ? '#4caf82' : '#e0b64c'),
      done: doneSchedules.has(schedule.id),
      skipped: skippedSchedules.has(schedule.id),
      target: { kind: 'schedule', scheduleId: schedule.id },
      category: occurrence.category,
      description: occurrence.description,
      isException: occurrence.isException,
      segments: occurrence.segments
        ? occurrence.segments.map((segment) => ({
            type: segment.tipo !== 'pausa' ? 'pomodoro' : segment.minutos >= 15 ? 'long-break' : 'short-break',
            startMinute: occurrence.startMinute + segment.startOffset,
            endMinute: occurrence.startMinute + segment.endOffset,
            label: segment.etiqueta,
          }))
        : isWork
        ? generateFocusPlan(
            schedule.startMinute,
            schedule.endMinute,
            resolveFocusPlanConfigWith({
              startMinute: schedule.startMinute,
              endMinute: schedule.endMinute,
              pomodoroMin: schedule.pomodoroMin ?? null,
              shortBreakMin: schedule.shortBreakMin ?? null,
              longBreakMin: schedule.longBreakMin ?? null,
              pomodorosPerChunk: schedule.pomodorosPerChunk ?? null,
              chunks: schedule.chunks ?? null,
            }),
          )
        : [],
    });
  }

  for (const habit of data.habits) {
    if (habit.archived || habit.reminderEndMinute == null) continue;
    const days = habit.reminderDaysOfWeek?.length ? habit.reminderDaysOfWeek : [0, 1, 2, 3, 4, 5, 6];
    if (!days.includes(day)) continue;
    const end = habit.reminderEndMinute;
    const start = habit.reminderStartMinute ?? Math.max(0, end - DEADLINE_BLOCK_MINUTES);
    const record = findRecordForDate(data.habitRecords, habit.id, key);
    blocks.push({
      id: `habit-${habit.id}`,
      kind: 'habit',
      title: habit.title,
      startMinute: start,
      endMinute: end,
      when: habit.reminderStartMinute == null ? `antes de las ${minuteLabel(end)}` : rangeLabel(start, end),
      color: habit.color ?? DEFAULT_HABIT_COLOR,
      done: record?.status === 'DONE',
      target: { kind: 'habit', habitId: habit.id, recordId: record?.id ?? null },
      segments: [],
    });
  }

  for (const task of data.tasks) {
    if (!task.scheduledAt) continue;
    const at = new Date(task.scheduledAt);
    if (dateKey(at) !== key) continue;
    const start = at.getHours() * 60 + at.getMinutes();
    const end = Math.min(24 * 60, start + Math.max(15, task.estimatedMinutes ?? 30));
    blocks.push({
      id: `task-${task.id}`,
      kind: 'task',
      title: task.title,
      startMinute: start,
      endMinute: end,
      when: rangeLabel(start, end),
      color: '#4ee0a0',
      done: task.status === 'COMPLETED',
      target: null,
      segments: [],
    });
  }

  return blocks.sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);
}
