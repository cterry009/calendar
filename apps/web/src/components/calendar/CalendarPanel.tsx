import { useMemo, useState } from 'react';
import { AppButton, AppCard, H2, Paragraph, YStack } from '@calendar/ui';
import { useCalendarData } from '../../hooks/useCalendarData';
import type { CalendarViewMode } from '../../lib/calendar/types';
import {
  buildEventsForRange,
  buildMonthSummary,
  buildWeekTaskSummary,
  endOfDay,
  eventsForDate,
  getEndOfWeek,
  getStartOfMonth,
  getStartOfWeek,
  startOfDay,
} from '../../lib/calendar/utils';
import { CalendarToolbar } from './CalendarToolbar';
import { DayView } from './DayView';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';

function getRangeForMode(mode: CalendarViewMode, selectedDate: Date): { start: Date; end: Date } {
  if (mode === 'day') {
    const dayStart = startOfDay(selectedDate);
    return { start: dayStart, end: endOfDay(dayStart) };
  }

  if (mode === 'week') {
    return { start: getStartOfWeek(selectedDate), end: getEndOfWeek(selectedDate) };
  }

  return {
    start: getStartOfWeek(getStartOfMonth(selectedDate)),
    end: getEndOfWeek(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0)),
  };
}

export function CalendarPanel() {
  const [mode, setMode] = useState<CalendarViewMode>('week');
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const data = useCalendarData();

  const range = useMemo(() => getRangeForMode(mode, selectedDate), [mode, selectedDate]);

  const events = useMemo(
    () =>
      buildEventsForRange(
        {
          tasks: data.tasks,
          schedules: data.schedules,
          pomodoroSessions: data.pomodoroSessions,
          fitnessEntries: data.fitnessEntries,
        },
        range.start,
        range.end,
      ),
    [data.fitnessEntries, data.pomodoroSessions, data.schedules, data.tasks, range.end, range.start],
  );

  const dayEvents = useMemo(() => eventsForDate(events, selectedDate), [events, selectedDate]);
  const weekSummary = useMemo(() => buildWeekTaskSummary(data.tasks, selectedDate), [data.tasks, selectedDate]);
  const monthSummary = useMemo(
    () => buildMonthSummary({ tasks: data.tasks, pomodoroSessions: data.pomodoroSessions }, selectedDate),
    [data.pomodoroSessions, data.tasks, selectedDate],
  );

  return (
    <YStack gap="$4">
      <CalendarToolbar
        mode={mode}
        selectedDate={selectedDate}
        onModeChange={setMode}
        onChangeDate={setSelectedDate}
      />

      {data.isLoading ? (
        <AppCard>
          <Paragraph margin={0}>Cargando calendario...</Paragraph>
        </AppCard>
      ) : null}

      {!data.isLoading && data.error ? (
        <AppCard>
          <YStack gap="$3">
            <H2 margin={0} fontSize="$6">
              No se pudo cargar
            </H2>
            <Paragraph color="$muted" margin={0}>
              {data.error}
            </Paragraph>
            <AppButton variant="small" alignSelf="flex-start" onPress={() => void data.refetch()}>
              Reintentar
            </AppButton>
          </YStack>
        </AppCard>
      ) : null}

      {!data.isLoading && !data.error ? (
        mode === 'day' ? (
          <DayView selectedDate={selectedDate} events={dayEvents} />
        ) : mode === 'week' ? (
          <WeekView days={weekSummary} />
        ) : (
          <MonthView days={monthSummary} />
        )
      ) : null}

      {data.syncedAt ? (
        <Paragraph size="$2" color="$muted" margin={0}>
          Última sincronización: {new Date(data.syncedAt).toLocaleString('es-ES')}
        </Paragraph>
      ) : null}
    </YStack>
  );
}
