import { useState } from 'react';
import { AppCard, XStack, YStack } from '@calendar/ui';
import { CalendarPanel } from '../components/calendar/CalendarPanel';
import { DayTasksSidebar } from '../components/calendar/DayTasksSidebar';
import { MiniMonthCalendar } from '../components/calendar/MiniMonthCalendar';
import { PageHeader } from '../components/PageHeader';
import { useLanguage } from '../context/LanguageContext';
import type { CalendarViewMode } from '../lib/calendar/types';
import { startOfDay } from '../lib/calendar/utils';
import { ScheduleManager } from '../components/schedules/ScheduleManager';

export function CalendarPage() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<CalendarViewMode>('week');
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));

  return (
    <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$7" gap="$5">
      <PageHeader
        eyebrow={t('calendarHub.eyebrow')}
        title={t('calendarHub.title')}
        description={t('calendarHub.description')}
        tutorialId="calendar-hero"
        maxWidth={700}
      />

      <XStack gap="$5" flexWrap="wrap" alignItems="flex-start">
        <YStack flex={2} minWidth={360}>
          <CalendarPanel mode={mode} selectedDate={selectedDate} onModeChange={setMode} onChangeDate={setSelectedDate} />
        </YStack>

        <YStack flex={1} minWidth={300} gap="$5">
          <AppCard>
            <MiniMonthCalendar
              selectedDate={selectedDate}
              onSelectDate={(date) => {
                setSelectedDate(startOfDay(date));
                setMode('day');
              }}
            />
          </AppCard>
          <YStack data-tutorial="schedule-header">
            <ScheduleManager />
          </YStack>
          <DayTasksSidebar selectedDate={selectedDate} />
        </YStack>
      </XStack>
    </YStack>
  );
}
