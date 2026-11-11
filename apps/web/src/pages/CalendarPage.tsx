import { useEffect, useRef, useState } from 'react';
import { XStack, YStack } from '@calendar/ui';
import { CalendarPanel } from '../components/calendar/CalendarPanel';
import { HoyDashboard } from '../components/agenda/HoySections';
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
  // 2026-11-10: /hoy now lands here as ?vista=dia.
  const [mode, setMode] = useState<CalendarViewMode>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('vista') === 'dia' ? 'day' : 'week',
  );
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
        <YStack flex={1} minWidth={360}>
          <CalendarPanel
            mode={mode}
            selectedDate={selectedDate}
            onModeChange={setMode}
            onChangeDate={setSelectedDate}
            dayContent={isSameDay(selectedDate, today) ? <HoyDashboard /> : undefined}
          />
        </YStack>

      </XStack>
    </YStack>
  );
}
