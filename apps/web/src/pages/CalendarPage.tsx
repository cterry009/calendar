import { useEffect, useRef, useState } from 'react';
import { XStack, YStack } from '@calendar/ui';
import { SidePanelTabs } from '../components/sidepanel/SidePanelTabs';
import { CalendarPanel } from '../components/calendar/CalendarPanel';
import { PageHeader } from '../components/PageHeader';
import { useLanguage } from '../context/LanguageContext';
import type { CalendarViewMode } from '../lib/calendar/types';
import { startOfDay } from '../lib/calendar/utils';
import { useToday } from '../hooks/useNow';
import { isSameDay } from '../lib/calendar/utils';

export function CalendarPage() {
  const { t } = useLanguage();
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

      <XStack gap="$5" flexWrap="wrap" alignItems="flex-start">
        <YStack flex={2} minWidth={360}>
          <CalendarPanel mode={mode} selectedDate={selectedDate} onModeChange={setMode} onChangeDate={setSelectedDate} />
        </YStack>

        <YStack flex={1} minWidth={320} maxWidth={460}>
          <SidePanelTabs
            selectedDate={selectedDate}
            onSelectDate={(date) => {
              setSelectedDate(startOfDay(date));
              setMode('day');
            }}
          />
        </YStack>
      </XStack>
    </YStack>
  );
}
