import { useEffect, useRef, useState } from 'react';
import { AppCard, XStack, YStack } from '@calendar/ui';
import { DayTasksSidebar } from '../components/calendar/DayTasksSidebar';
import { MiniMonthCalendar } from '../components/calendar/MiniMonthCalendar';
import { ScheduleManager } from '../components/schedules/ScheduleManager';
import { MorningCard } from '../components/morning/MorningCard';
import { PlanSuggestionCard } from '../components/planning/PlanSuggestionCard';
import { CalendarPanel } from '../components/calendar/CalendarPanel';
import { PageHeader } from '../components/PageHeader';
import { rememberedTab, rememberTab, SubTabs } from '../components/agenda/SubTabs';
import { HorarioPage } from './HorarioPage';
import { useLanguage } from '../context/LanguageContext';
import type { CalendarViewMode } from '../lib/calendar/types';
import { startOfDay } from '../lib/calendar/utils';
import { useToday } from '../hooks/useNow';
import { isSameDay } from '../lib/calendar/utils';

export function CalendarPage() {
  const { t } = useLanguage();
  const [view, setView] = useState<'calendario' | 'horario'>(() =>
    rememberedTab('calendar.calendario.view', ['calendario', 'horario'] as const, 'calendario'),
  );
  const [mode, setMode] = useState<CalendarViewMode>('week');
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  // 2026-11-09: when the day changes with the app open, follow it -- unless the user had moved
  // to another day on purpose.
  const today = useToday();
  const previousToday = useRef(today);
  useEffect(() => {
    if (previousToday.current === today) return;
    const wasOnToday = isSameDay(selectedDate, previousToday.current);
    previousToday.current = today;
    if (wasOnToday) setSelectedDate(today);
  }, [today, selectedDate]);

  return (
    <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$6" gap="$4">
      <PageHeader
        eyebrow={t('calendarHub.eyebrow')}
        title={t('calendarHub.title')}
        tutorialId="calendar-hero"
        maxWidth={700}
      />
      <SubTabs
        tabs={[
          { id: 'calendario', label: 'Calendario' },
          { id: 'horario', label: 'Horario' },
        ]}
        value={view}
        onChange={(id) => {
          setView(id);
          rememberTab('calendar.calendario.view', id);
        }}
      />

      {view === 'horario' ? <HorarioPage /> : null}
      <XStack display={view === 'calendario' ? 'flex' : 'none'} gap="$5" flexWrap="wrap" alignItems="flex-start">
        <YStack flex={2} minWidth={360}>
          <CalendarPanel mode={mode} selectedDate={selectedDate} onModeChange={setMode} onChangeDate={setSelectedDate} />
        </YStack>

        <YStack flex={1} minWidth={300} gap="$5">
          <PlanSuggestionCard />
          <MorningCard />
          <AppCard>
            <MiniMonthCalendar
              selectedDate={selectedDate}
              onSelectDate={(date) => {
                setSelectedDate(startOfDay(date));
                setMode('day');
              }}
            />
          </AppCard>
          <DayTasksSidebar selectedDate={selectedDate} />
          <YStack data-tutorial="schedule-header">
            <ScheduleManager />
          </YStack>
        </YStack>
      </XStack>
    </YStack>
  );
}
