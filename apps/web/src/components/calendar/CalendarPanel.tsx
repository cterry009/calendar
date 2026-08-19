import { useMemo } from 'react';
import { AppButton, AppCard, H2, Paragraph, YStack } from '@calendar/ui';
import { useLanguage } from '../../context/LanguageContext';
import { usePanel } from '../../context/PanelContext';
import { usePomodoro } from '../../context/PomodoroContext';
import { useCalendarData } from '../../hooks/useCalendarData';
import { useFitness } from '../../hooks/useFitness';
import { useTasks } from '../../hooks/useTasks';
import type { CalendarViewMode } from '../../lib/calendar/types';
import {
  addDays,
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
import { WeekTimeGrid } from './WeekTimeGrid';
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

interface CalendarPanelProps {
  mode: CalendarViewMode;
  selectedDate: Date;
  onModeChange: (mode: CalendarViewMode) => void;
  onChangeDate: (date: Date) => void;
}

export function CalendarPanel({ mode, selectedDate, onModeChange, onChangeDate }: CalendarPanelProps) {
  const { t, locale } = useLanguage();
  const data = useCalendarData();
  const tasksData = useTasks();
  const fitnessData = useFitness();
  const pomodoro = usePomodoro();
  const { openPanel } = usePanel();

  function selectDay(date: Date) {
    onChangeDate(startOfDay(date));
    onModeChange('day');
  }

  async function handleCreateTask(values: Parameters<typeof tasksData.createTask>[0]) {
    await tasksData.createTask(values);
    await data.refetch();
  }

  async function handleCreateFitness(values: Parameters<typeof fitnessData.createEntry>[0]) {
    await fitnessData.createEntry(values);
    await data.refetch();
  }

  async function handleStartFocusSegment(focusDurationMin: number, taskId?: string) {
    await pomodoro.start(taskId, { focusDurationMin });
    openPanel('pomodoro');
  }

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
  const weekDays = useMemo(() => {
    const weekStart = getStartOfWeek(selectedDate);
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  }, [selectedDate]);
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
        onModeChange={onModeChange}
        onChangeDate={onChangeDate}
      />

      {data.isLoading ? (
        <AppCard>
          <Paragraph margin={0}>{t('calendarHub.loading')}</Paragraph>
        </AppCard>
      ) : null}

      {!data.isLoading && data.error ? (
        <AppCard>
          <YStack gap="$3">
            <H2 margin={0} fontSize="$6">
              {t('calendarHub.loadError.title')}
            </H2>
            <Paragraph color="$muted" margin={0}>
              {data.error}
            </Paragraph>
            <AppButton variant="small" alignSelf="flex-start" onPress={() => void data.refetch()}>
              {t('calendarHub.loadError.retry')}
            </AppButton>
          </YStack>
        </AppCard>
      ) : null}

      {tasksData.error ? (
        <AppCard>
          <Paragraph color="$error" margin={0}>
            {tasksData.error}
          </Paragraph>
        </AppCard>
      ) : null}

      {fitnessData.error ? (
        <AppCard>
          <Paragraph color="$error" margin={0}>
            {fitnessData.error}
          </Paragraph>
        </AppCard>
      ) : null}

      {!data.isLoading && !data.error ? (
        mode === 'day' ? (
          <YStack gap="$4">
            <DayView
              selectedDate={selectedDate}
              events={dayEvents}
              onCreateTask={handleCreateTask}
              isCreatingTask={tasksData.isMutating}
              onCreateFitness={handleCreateFitness}
              isCreatingFitness={fitnessData.isMutating}
              onStartFocusSegment={handleStartFocusSegment}
              isStartingFocus={pomodoro.isMutating}
            />
            <WeekView days={weekSummary} onSelectDay={selectDay} />
          </YStack>
        ) : mode === 'week' ? (
          <YStack gap="$4">
            <WeekTimeGrid weekDays={weekDays} events={events} onSelectDay={selectDay} />
            <WeekView days={weekSummary} onSelectDay={selectDay} />
          </YStack>
        ) : (
          <MonthView days={monthSummary} onSelectDay={selectDay} />
        )
      ) : null}

      {data.syncedAt ? (
        <Paragraph size="$2" color="$muted" margin={0}>
          {t('calendarHub.lastSynced')}: {new Date(data.syncedAt).toLocaleString(locale)}
        </Paragraph>
      ) : null}
    </YStack>
  );
}
