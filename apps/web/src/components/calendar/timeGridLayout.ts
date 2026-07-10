import type { CalendarEvent } from '../../lib/calendar/types';
import { generateFocusPlan, resolveFocusPlanConfig } from '../../lib/pomodoro/planner';
import { EVENT_TYPE_COLOR, SEGMENT_COLOR, SEGMENT_LABEL } from './eventStyles';

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2.5;
export const ZOOM_STEP = 0.25;
export const DEFAULT_ZOOM = 1;

export function clampZoom(zoom: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

export interface GridBar {
  id: string;
  label: string;
  detail: string;
  startMinute: number;
  endMinute: number;
  color: string;
  lane: 'background' | 'foreground';
  interactive?: boolean;
  /** Set when this bar is a pomodoro segment claimed by a task, so starting it can be linked
   * back to that task. */
  taskId?: string;
}

export function minuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function minuteToLabel(minute: number): string {
  const hour = Math.floor(minute / 60) % 24;
  const min = minute % 60;
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function pomodoroUnitsFor(task: CalendarEvent, pomodoroMin: number): number {
  if (task.meta?.estimatedPomodoros) return Math.max(1, task.meta.estimatedPomodoros);
  const minutes = task.meta?.estimatedMinutes ?? task.end.getTime() - task.start.getTime();
  return Math.max(1, Math.round(minutes / pomodoroMin));
}

/** Expands a day's work/rest blocks (into their auto pomodoro-plan segments) and other events
 * (tasks/fitness/pomodoro sessions) into positioned-ready grid bars. Tasks scheduled inside a
 * work block automatically claim that block's next available pomodoro segments in order (oldest
 * task first), splitting across whatever breaks fall in between -- a 3-pomodoro task shows up as
 * 3 separate labeled slots, not one solid bar that would run straight through a break. */
export function buildDayBars(events: CalendarEvent[]): GridBar[] {
  const blocks = events
    .filter((event) => event.type === 'work' || event.type === 'rest')
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const otherEvents = events.filter((event) => event.type !== 'work' && event.type !== 'rest');

  const result: GridBar[] = [];
  const consumedTaskIds = new Set<string>();

  for (const block of blocks) {
    if (block.type === 'work') {
      const config = resolveFocusPlanConfig({
        startMinute: minuteOfDay(block.start),
        endMinute: minuteOfDay(block.end),
        pomodoroMin: block.meta?.pomodoroMin ?? null,
        shortBreakMin: block.meta?.shortBreakMin ?? null,
        longBreakMin: block.meta?.longBreakMin ?? null,
        pomodorosPerChunk: block.meta?.pomodorosPerChunk ?? null,
        chunks: block.meta?.chunks ?? null,
      });
      const plan = generateFocusPlan(minuteOfDay(block.start), minuteOfDay(block.end), config);

      const blockTasks = otherEvents
        .filter((event) => event.type === 'task' && event.start >= block.start && event.start < block.end)
        .sort((a, b) => (a.meta?.createdAt ?? '').localeCompare(b.meta?.createdAt ?? '') || a.id.localeCompare(b.id))
        .map((task) => {
          const totalUnits = pomodoroUnitsFor(task, config.pomodoroMin);
          return { task, totalUnits, remaining: totalUnits };
        });

      let queueIndex = 0;

      plan.forEach((segment, index) => {
        const current = queueIndex < blockTasks.length ? blockTasks[queueIndex] : null;

        if (segment.type === 'pomodoro' && current) {
          const position = current.totalUnits - current.remaining + 1;

          result.push({
            id: `${block.id}-segment-${index}`,
            label: current.task.title,
            detail: `Pomodoro ${position}/${current.totalUnits} · ${minuteToLabel(segment.startMinute)} - ${minuteToLabel(segment.endMinute)}`,
            startMinute: segment.startMinute,
            endMinute: segment.endMinute,
            color: EVENT_TYPE_COLOR.task,
            lane: 'background',
            interactive: true,
            taskId: current.task.id,
          });

          consumedTaskIds.add(current.task.id);
          current.remaining -= 1;
          if (current.remaining <= 0) queueIndex += 1;
        } else {
          result.push({
            id: `${block.id}-segment-${index}`,
            label: SEGMENT_LABEL[segment.type],
            detail: `${minuteToLabel(segment.startMinute)} - ${minuteToLabel(segment.endMinute)}`,
            startMinute: segment.startMinute,
            endMinute: segment.endMinute,
            color: SEGMENT_COLOR[segment.type],
            lane: 'background',
            interactive: segment.type === 'pomodoro',
          });
        }
      });
    } else {
      result.push({
        id: block.id,
        label: block.title,
        detail: `${minuteToLabel(minuteOfDay(block.start))} - ${minuteToLabel(minuteOfDay(block.end))}`,
        startMinute: minuteOfDay(block.start),
        endMinute: minuteOfDay(block.end),
        color: EVENT_TYPE_COLOR.rest,
        lane: 'background',
      });
    }
  }

  for (const event of otherEvents) {
    if (event.type === 'task' && consumedTaskIds.has(event.id)) continue;

    result.push({
      id: event.id,
      label: event.title,
      detail: `${minuteToLabel(minuteOfDay(event.start))} - ${minuteToLabel(minuteOfDay(event.end))}`,
      startMinute: minuteOfDay(event.start),
      endMinute: minuteOfDay(event.end),
      color: EVENT_TYPE_COLOR[event.type],
      lane: 'foreground',
    });
  }

  return result;
}

/**
 * Heights based purely on duration would either make 5-minute breaks illegibly thin or, if
 * given a flat minimum, overlap the very next segment when segments are back-to-back (as a
 * pomodoro plan's segments always are). Instead each bar borrows headroom only from the gap
 * to whatever starts next in the same lane, so a boosted bar can never encroach on it.
 */
export function layoutBars(
  sortedBars: GridBar[],
  rowHeightPx: number,
  minBarHeightPx: number,
  laneEndPx: number,
): Array<GridBar & { top: number; height: number }> {
  return sortedBars.map((bar, index) => {
    const top = (bar.startMinute / 60) * rowHeightPx;
    const nextTop = index + 1 < sortedBars.length ? (sortedBars[index + 1].startMinute / 60) * rowHeightPx : laneEndPx;
    const naturalHeight = ((bar.endMinute - bar.startMinute) / 60) * rowHeightPx;
    const height = Math.min(Math.max(minBarHeightPx, naturalHeight), Math.max(naturalHeight, nextTop - top));
    return { ...bar, top, height };
  });
}
