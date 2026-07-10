import type { CalendarEvent } from '../../lib/calendar/types';
import { generateFocusPlan, resolveFocusPlanConfig } from '../../lib/pomodoro/planner';
import { EVENT_TYPE_COLOR, SEGMENT_COLOR, SEGMENT_LABEL } from './eventStyles';

export interface GridBar {
  id: string;
  label: string;
  detail: string;
  startMinute: number;
  endMinute: number;
  color: string;
  lane: 'background' | 'foreground';
  interactive?: boolean;
}

export function minuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function minuteToLabel(minute: number): string {
  const hour = Math.floor(minute / 60) % 24;
  const min = minute % 60;
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Expands a day's work/rest blocks (into their auto pomodoro-plan segments) and other events
 * (tasks/fitness/pomodoro sessions) into positioned-ready grid bars. */
export function buildDayBars(events: CalendarEvent[]): GridBar[] {
  const blocks = events
    .filter((event) => event.type === 'work' || event.type === 'rest')
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const otherEvents = events.filter((event) => event.type !== 'work' && event.type !== 'rest');

  const result: GridBar[] = [];

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

      plan.forEach((segment, index) => {
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
