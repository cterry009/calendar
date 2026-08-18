import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, XStack, YStack } from '@calendar/ui';
import type { CalendarEvent } from '../../lib/calendar/types';
import { eventsForDate, isSameDay } from '../../lib/calendar/utils';
import { buildDayBars, clampZoom, DEFAULT_ZOOM, layoutBars, minuteOfDay, ZOOM_STEP } from './timeGridLayout';
import { ZoomControls } from './ZoomControls';

const BASE_ROW_HEIGHT_PX = 48;
const VISIBLE_HEIGHT_PX = 640;
const BASE_MIN_BAR_HEIGHT_PX = 16;
const HOUR_LABEL_WIDTH_PX = 56;
const DAY_COLUMN_MIN_WIDTH_PX = 120;

interface WeekTimeGridProps {
  weekDays: Date[];
  events: CalendarEvent[];
  onSelectDay: (date: Date) => void;
}

/** Google Calendar-style 7-day grid: one column per day, all sharing the same hour rows,
 * each rendering that day's schedule (pomodoro plan segments, rest blocks, tasks, fitness). */
export function WeekTimeGrid({ weekDays, events, onSelectDay }: WeekTimeGridProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const today = useMemo(() => new Date(), []);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  const rowHeightPx = BASE_ROW_HEIGHT_PX * zoom;
  const gridHeightPx = rowHeightPx * 24;
  const minBarHeightPx = BASE_MIN_BAR_HEIGHT_PX * zoom;

  const dayColumns = useMemo(
    () =>
      weekDays.map((date) => {
        const bars = buildDayBars(eventsForDate(events, date));
        const backgroundBars = layoutBars(
          bars.filter((bar) => bar.lane === 'background').sort((a, b) => a.startMinute - b.startMinute),
          rowHeightPx,
          minBarHeightPx,
          gridHeightPx,
        );
        const foregroundBars = layoutBars(
          bars.filter((bar) => bar.lane === 'foreground').sort((a, b) => a.startMinute - b.startMinute),
          rowHeightPx,
          minBarHeightPx,
          gridHeightPx,
        );
        return { date, isToday: isSameDay(date, today), backgroundBars, foregroundBars };
      }),
    [weekDays, events, today, rowHeightPx, minBarHeightPx, gridHeightPx],
  );

  useEffect(() => {
    if (!scrollRef.current) return;
    const allBars = dayColumns.flatMap((column) => [...column.backgroundBars, ...column.foregroundBars]);
    const anchorMinute = allBars.length > 0 ? Math.min(...allBars.map((bar) => bar.startMinute)) : 7 * 60;
    scrollRef.current.scrollTop = Math.max(0, (anchorMinute / 60) * rowHeightPx - rowHeightPx);
    // Re-anchor when the viewed week or zoom level changes, not on every bar recompute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekDays[0]?.toISOString(), zoom]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return undefined;
    function handleWheel(event: WheelEvent) {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      setZoom((current) => clampZoom(current + (event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP)));
    }
    node.addEventListener('wheel', handleWheel, { passive: false });
    return () => node.removeEventListener('wheel', handleWheel);
  }, []);

  const nowMinute = minuteOfDay(new Date());

  return (
    <YStack gap="$2">
      <XStack justifyContent="flex-end">
        <ZoomControls
          zoom={zoom}
          onZoomIn={() => setZoom((current) => clampZoom(current + ZOOM_STEP))}
          onZoomOut={() => setZoom((current) => clampZoom(current - ZOOM_STEP))}
          onReset={() => setZoom(DEFAULT_ZOOM)}
        />
      </XStack>

      <YStack borderRadius="$4" borderWidth={1} borderColor="$borderColor" overflow="hidden">
      <XStack borderBottomWidth={1} borderBottomColor="$borderColor">
        <YStack width={HOUR_LABEL_WIDTH_PX} flexShrink={0} />
        {dayColumns.map((column) => (
          <YStack
            key={column.date.toISOString()}
            flex={1}
            minWidth={DAY_COLUMN_MIN_WIDTH_PX}
            alignItems="center"
            paddingVertical="$2"
            cursor="pointer"
            onPress={() => onSelectDay(column.date)}
            hoverStyle={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
          >
            <Text fontSize="$1" color="$muted" textTransform="uppercase" letterSpacing={1}>
              {column.date.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '')}
            </Text>
            <YStack
              width={32}
              height={32}
              borderRadius={16}
              alignItems="center"
              justifyContent="center"
              backgroundColor={column.isToday ? '$primary' : 'transparent'}
              marginTop="$1"
            >
              <Text fontSize="$5" fontWeight="700" color={column.isToday ? '#0a1c13' : '$color'}>
                {column.date.getDate()}
              </Text>
            </YStack>
          </YStack>
        ))}
      </XStack>

      <YStack ref={scrollRef as never} maxHeight={VISIBLE_HEIGHT_PX} overflow="scroll">
        <XStack height={gridHeightPx}>
          <YStack width={HOUR_LABEL_WIDTH_PX} flexShrink={0}>
            {Array.from({ length: 24 }, (_, hour) => (
              <YStack key={hour} height={rowHeightPx} paddingLeft="$1" paddingTop="$1">
                <Text fontSize="$1" color="$muted">
                  {String(hour).padStart(2, '0')}:00
                </Text>
              </YStack>
            ))}
          </YStack>

          {dayColumns.map((column) => (
            <YStack
              key={column.date.toISOString()}
              flex={1}
              minWidth={DAY_COLUMN_MIN_WIDTH_PX}
              position="relative"
              borderLeftWidth={1}
              borderLeftColor="rgba(255,255,255,0.06)"
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <YStack
                  key={hour}
                  position="absolute"
                  top={hour * rowHeightPx}
                  left={0}
                  right={0}
                  height={rowHeightPx}
                  borderTopWidth={1}
                  borderTopColor="rgba(255,255,255,0.06)"
                />
              ))}

              {column.backgroundBars.map((bar) => (
                <YStack
                  key={bar.id}
                  position="absolute"
                  top={bar.top}
                  left={2}
                  right={2}
                  height={bar.height}
                  title={`${bar.label} · ${bar.detail}`}
                  borderRadius="$2"
                  borderWidth={1}
                  borderColor={bar.color}
                  backgroundColor="rgba(255,255,255,0.03)"
                  paddingHorizontal="$1"
                  overflow="hidden"
                >
                  {bar.height >= 14 ? (
                    <Text fontSize="$1" color={bar.color} fontWeight="600" lineHeight={12}>
                      {bar.label}
                    </Text>
                  ) : null}
                </YStack>
              ))}

              {column.foregroundBars.map((bar) => (
                <YStack
                  key={bar.id}
                  position="absolute"
                  top={bar.top}
                  left={8}
                  right={2}
                  height={bar.height}
                  title={`${bar.label} · ${bar.detail}`}
                  borderRadius="$2"
                  backgroundColor={bar.color}
                  paddingHorizontal="$1"
                  overflow="hidden"
                  zIndex={2}
                >
                  {bar.height >= 14 ? (
                    <Text fontSize="$1" fontWeight="700" color="#0a1c13" lineHeight={12}>
                      {bar.label}
                    </Text>
                  ) : null}
                </YStack>
              ))}

              {column.isToday ? (
                <YStack
                  position="absolute"
                  top={(nowMinute / 60) * rowHeightPx}
                  left={0}
                  right={0}
                  height={2}
                  backgroundColor="$error"
                  zIndex={3}
                />
              ) : null}
            </YStack>
          ))}
        </XStack>
      </YStack>
      </YStack>
    </YStack>
  );
}
