import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, XStack, YStack } from '@calendar/ui';
import type { CalendarEvent } from '../../lib/calendar/types';
import { buildDayBars, clampZoom, DEFAULT_ZOOM, layoutBars, minuteOfDay, ZOOM_STEP } from './timeGridLayout';
import { ZoomControls } from './ZoomControls';

const BASE_ROW_HEIGHT_PX = 96;
const VISIBLE_HEIGHT_PX = 760;
const BASE_MIN_BAR_HEIGHT_PX = 24;
const HOUR_LABEL_WIDTH_PX = 64;

interface DayTimeGridProps {
  selectedDate: Date;
  blocks: CalendarEvent[];
  otherEvents: CalendarEvent[];
  isToday: boolean;
  onStartFocusSegment: (focusDurationMin: number, taskId?: string) => Promise<void>;
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
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  const rowHeightPx = BASE_ROW_HEIGHT_PX * zoom;
  const gridHeightPx = rowHeightPx * 24;
  const minBarHeightPx = BASE_MIN_BAR_HEIGHT_PX * zoom;

  const bars = useMemo(() => buildDayBars([...blocks, ...otherEvents]), [blocks, otherEvents]);

  const nowMinute = isToday ? minuteOfDay(new Date()) : -1;

  useEffect(() => {
    if (!scrollRef.current) return;
    const anchorMinute = bars.length > 0 ? Math.min(...bars.map((bar) => bar.startMinute)) : 7 * 60;
    scrollRef.current.scrollTop = Math.max(0, (anchorMinute / 60) * rowHeightPx - rowHeightPx);
    // Re-anchor when the viewed date or zoom level changes, not on every bar recompute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, zoom]);

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

  const backgroundBars = useMemo(
    () =>
      layoutBars(
        bars.filter((bar) => bar.lane === 'background').sort((a, b) => a.startMinute - b.startMinute),
        rowHeightPx,
        minBarHeightPx,
        gridHeightPx,
      ),
    [bars, rowHeightPx, minBarHeightPx, gridHeightPx],
  );
  const foregroundBars = useMemo(
    () =>
      layoutBars(
        bars.filter((bar) => bar.lane === 'foreground').sort((a, b) => a.startMinute - b.startMinute),
        rowHeightPx,
        minBarHeightPx,
        gridHeightPx,
      ),
    [bars, rowHeightPx, minBarHeightPx, gridHeightPx],
  );

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

      <YStack
        ref={scrollRef as never}
        maxHeight={VISIBLE_HEIGHT_PX}
        overflow="scroll"
        borderRadius="$4"
        borderWidth={1}
        borderColor="$borderColor"
      >
        <XStack height={gridHeightPx}>
          <YStack width={HOUR_LABEL_WIDTH_PX} flexShrink={0}>
            {Array.from({ length: 24 }, (_, hour) => (
              <YStack key={hour} height={rowHeightPx} paddingLeft="$2" paddingTop="$1">
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
                top={hour * rowHeightPx}
                left={0}
                right={0}
                height={rowHeightPx}
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
                onPress={canStart ? () => void onStartFocusSegment(bar.endMinute - bar.startMinute, bar.taskId) : undefined}
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
            <YStack position="absolute" top={(nowMinute / 60) * rowHeightPx} left={0} right={0} height={2} backgroundColor="$error" zIndex={3} />
          ) : null}
          </YStack>
        </XStack>
      </YStack>
    </YStack>
  );
}
