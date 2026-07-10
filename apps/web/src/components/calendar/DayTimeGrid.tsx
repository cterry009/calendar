import { useEffect, useMemo, useRef } from 'react';
import { Text, XStack, YStack } from '@calendar/ui';
import type { CalendarEvent } from '../../lib/calendar/types';
import { buildDayBars, layoutBars, minuteOfDay } from './timeGridLayout';

const ROW_HEIGHT_PX = 96;
const GRID_HEIGHT_PX = ROW_HEIGHT_PX * 24;
const VISIBLE_HEIGHT_PX = 760;
const MIN_BAR_HEIGHT_PX = 24;
const HOUR_LABEL_WIDTH_PX = 64;

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

  const bars = useMemo(() => buildDayBars([...blocks, ...otherEvents]), [blocks, otherEvents]);

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
        ROW_HEIGHT_PX,
        MIN_BAR_HEIGHT_PX,
        GRID_HEIGHT_PX,
      ),
    [bars],
  );
  const foregroundBars = useMemo(
    () =>
      layoutBars(
        bars.filter((bar) => bar.lane === 'foreground').sort((a, b) => a.startMinute - b.startMinute),
        ROW_HEIGHT_PX,
        MIN_BAR_HEIGHT_PX,
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
            <YStack key={hour} height={ROW_HEIGHT_PX} paddingLeft="$2" paddingTop="$1">
              <Text fontSize="$2" color="$muted">
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
                borderRadius="$3"
                borderWidth={isCurrent ? 3 : 1}
                borderColor={isCurrent ? '$primary' : bar.color}
                backgroundColor={isCurrent ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)'}
                paddingHorizontal="$3"
                paddingVertical={bar.height >= 30 ? 4 : 0}
                overflow="hidden"
                cursor={canStart ? 'pointer' : 'default'}
                opacity={canStart && isStartingFocus ? 0.6 : 1}
                onPress={canStart ? () => void onStartFocusSegment(bar.endMinute - bar.startMinute) : undefined}
              >
                {bar.height >= 18 ? (
                  <Text fontSize="$3" color={bar.color} fontWeight={isCurrent ? '800' : '600'} lineHeight={18}>
                    {canStart ? '▶ ' : ''}
                    {bar.label}
                  </Text>
                ) : null}
                {bar.height >= 50 ? (
                  <Text fontSize="$2" color="$muted">
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
              left={22}
              right={6}
              height={bar.height}
              title={`${bar.label} · ${bar.detail}`}
              borderRadius="$3"
              backgroundColor={bar.color}
              paddingHorizontal="$3"
              paddingVertical={bar.height >= 30 ? 4 : 0}
              overflow="hidden"
              zIndex={2}
            >
              {bar.height >= 18 ? (
                <Text fontSize="$3" fontWeight="800" color="#0a0f14" lineHeight={18}>
                  {bar.label}
                </Text>
              ) : null}
              {bar.height >= 50 ? (
                <Text fontSize="$2" color="#0a0f14" opacity={0.8}>
                  {bar.detail}
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
