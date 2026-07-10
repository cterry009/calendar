import { useEffect, useMemo, useRef } from 'react';
import { Text, XStack, YStack } from '@calendar/ui';
import type { CalendarEvent } from '../../lib/calendar/types';
import { generateFocusPlan, resolveFocusPlanConfig } from '../../lib/pomodoro/planner';
import { EVENT_TYPE_COLOR, SEGMENT_COLOR, SEGMENT_LABEL } from './eventStyles';

const ROW_HEIGHT_PX = 64;
const GRID_HEIGHT_PX = ROW_HEIGHT_PX * 24;
const VISIBLE_HEIGHT_PX = 560;
const MIN_BAR_HEIGHT_PX = 18;
const HOUR_LABEL_WIDTH_PX = 52;

/**
 * Heights based purely on duration would either make 5-minute breaks illegibly thin or, if
 * given a flat minimum, overlap the very next segment when segments are back-to-back (as a
 * pomodoro plan's segments always are). Instead each bar borrows headroom only from the gap
 * to whatever starts next in the same lane, so a boosted bar can never encroach on it.
 */
function layoutBars(sortedBars: GridBar[], laneEndPx: number): Array<GridBar & { top: number; height: number }> {
  return sortedBars.map((bar, index) => {
    const top = (bar.startMinute / 60) * ROW_HEIGHT_PX;
    const nextTop = index + 1 < sortedBars.length ? (sortedBars[index + 1].startMinute / 60) * ROW_HEIGHT_PX : laneEndPx;
    const naturalHeight = ((bar.endMinute - bar.startMinute) / 60) * ROW_HEIGHT_PX;
    const height = Math.min(Math.max(MIN_BAR_HEIGHT_PX, naturalHeight), Math.max(naturalHeight, nextTop - top));
    return { ...bar, top, height };
  });
}

interface GridBar {
  id: string;
  label: string;
  detail: string;
  startMinute: number;
  endMinute: number;
  color: string;
  lane: 'background' | 'foreground';
  interactive?: boolean;
}

function minuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function minuteToLabel(minute: number): string {
  const hour = Math.floor(minute / 60) % 24;
  const min = minute % 60;
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

interface DayTimeGridProps {
  selectedDate: Date;
  blocks: CalendarEvent[];
  otherEvents: CalendarEvent[];
  isToday: boolean;
  onStartFocusSegment: (focusDurationMin: number) => Promise<void>;
  isStartingFocus: boolean;
}

/** Renders the day's schedule as a Google Calendar-style hourly grid: events positioned and
 * sized by their actual clock time, instead of a flat list. */
export function DayTimeGrid({
  selectedDate,
  blocks,
  otherEvents,
  isToday,
  onStartFocusSegment,
  isStartingFocus,
}: DayTimeGridProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const bars = useMemo<GridBar[]>(() => {
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
  }, [blocks, otherEvents]);

  const nowMinute = isToday ? minuteOfDay(new Date()) : -1;

  useEffect(() => {
    if (!scrollRef.current) return;
    const anchorMinute = bars.length > 0 ? Math.min(...bars.map((bar) => bar.startMinute)) : 7 * 60;
    scrollRef.current.scrollTop = Math.max(0, (anchorMinute / 60) * ROW_HEIGHT_PX - ROW_HEIGHT_PX);
    // Only re-anchor when the viewed date changes, not on every bar recompute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const backgroundBars = useMemo(
    () =>
      layoutBars(
        bars.filter((bar) => bar.lane === 'background').sort((a, b) => a.startMinute - b.startMinute),
        GRID_HEIGHT_PX,
      ),
    [bars],
  );
  const foregroundBars = useMemo(
    () =>
      layoutBars(
        bars.filter((bar) => bar.lane === 'foreground').sort((a, b) => a.startMinute - b.startMinute),
        GRID_HEIGHT_PX,
      ),
    [bars],
  );

  return (
    <YStack
      ref={scrollRef as never}
      maxHeight={VISIBLE_HEIGHT_PX}
      overflow="scroll"
      borderRadius="$4"
      borderWidth={1}
      borderColor="$borderColor"
    >
      <XStack height={GRID_HEIGHT_PX}>
        <YStack width={HOUR_LABEL_WIDTH_PX} flexShrink={0}>
          {Array.from({ length: 24 }, (_, hour) => (
            <YStack key={hour} height={ROW_HEIGHT_PX} paddingLeft="$1" paddingTop="$1">
              <Text fontSize="$1" color="$muted">
                {String(hour).padStart(2, '0')}:00
              </Text>
            </YStack>
          ))}
        </YStack>

        <YStack flex={1} position="relative">
          {Array.from({ length: 24 }, (_, hour) => (
            <YStack
              key={hour}
              position="absolute"
              top={hour * ROW_HEIGHT_PX}
              left={0}
              right={0}
              height={ROW_HEIGHT_PX}
              borderTopWidth={1}
              borderTopColor="rgba(255,255,255,0.06)"
            />
          ))}

          {backgroundBars.map((bar) => {
            const isCurrent = isToday && nowMinute >= bar.startMinute && nowMinute < bar.endMinute;
            const canStart = Boolean(bar.interactive) && isCurrent;

            return (
              <YStack
                key={bar.id}
                position="absolute"
                top={bar.top}
                left={4}
                right={4}
                height={bar.height}
                title={`${bar.label} · ${bar.detail}`}
                borderRadius="$2"
                borderWidth={isCurrent ? 2 : 1}
                borderColor={isCurrent ? '$primary' : bar.color}
                backgroundColor={isCurrent ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)'}
                paddingHorizontal="$2"
                paddingVertical={bar.height >= 20 ? 2 : 0}
                overflow="hidden"
                cursor={canStart ? 'pointer' : 'default'}
                opacity={canStart && isStartingFocus ? 0.6 : 1}
                onPress={canStart ? () => void onStartFocusSegment(bar.endMinute - bar.startMinute) : undefined}
              >
                {bar.height >= 13 ? (
                  <Text fontSize="$1" color={bar.color} fontWeight={isCurrent ? '700' : '400'} lineHeight={13}>
                    {canStart ? '▶ ' : ''}
                    {bar.label}
                  </Text>
                ) : null}
                {bar.height >= 34 ? (
                  <Text fontSize="$1" color="$muted">
                    {bar.detail}
                  </Text>
                ) : null}
              </YStack>
            );
          })}

          {foregroundBars.map((bar) => (
            <YStack
              key={bar.id}
              position="absolute"
              top={bar.top}
              left={18}
              right={4}
              height={bar.height}
              title={`${bar.label} · ${bar.detail}`}
              borderRadius="$2"
              backgroundColor={bar.color}
              paddingHorizontal="$2"
              paddingVertical={bar.height >= 20 ? 2 : 0}
              overflow="hidden"
              zIndex={2}
            >
              {bar.height >= 13 ? (
                <Text fontSize="$1" fontWeight="700" color="#0a0f14" lineHeight={13}>
                  {bar.label}
                </Text>
              ) : null}
            </YStack>
          ))}

          {isToday && nowMinute >= 0 ? (
            <YStack position="absolute" top={(nowMinute / 60) * ROW_HEIGHT_PX} left={0} right={0} height={2} backgroundColor="$error" zIndex={3} />
          ) : null}
        </YStack>
      </XStack>
    </YStack>
  );
}
