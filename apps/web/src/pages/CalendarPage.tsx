import { useMemo, useState } from 'react';
import { Theme } from 'tamagui';
import { MOOD_LABELS, MOOD_STATES, PILLAR_LABELS, RITUAL_LABELS, SEROTONIN_RITUALS, suggestNextPillar, suggestNextRitual } from '@calendar/shared';
import { AppCard, XStack, YStack } from '@calendar/ui';
import { CalendarPanel } from '../components/calendar/CalendarPanel';
import { MiniMonthCalendar } from '../components/calendar/MiniMonthCalendar';
import { PageHeader } from '../components/PageHeader';
import { StatusCard } from '../components/StatusCard';
import { useSerotoninSession } from '../context/SerotoninSessionContext';
import type { CalendarViewMode } from '../lib/calendar/types';
import { startOfDay } from '../lib/calendar/utils';
import { ScheduleManager } from '../components/schedules/ScheduleManager';
import { TaskManager } from '../components/tasks/TaskManager';
import { SerotoninModePanel } from '../components/SerotoninModePanel';
import { SuggestionsPreview } from '../components/suggestions/SuggestionsPreview';

// morning_review/evening_shutdown complete through the dedicated Ritual panel's guided flow,
// not a bare "Completar" button, so they're excluded from this generic ritual card list.
const DISPLAYABLE_RITUALS = SEROTONIN_RITUALS.filter(
  (ritual) => ritual !== 'morning_review' && ritual !== 'evening_shutdown',
);

export function CalendarPage() {
  const { session, onRitual, onPillar, onMood } = useSerotoninSession();
  const [mode, setMode] = useState<CalendarViewMode>('week');
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));

  const nextPillar = session ? suggestNextPillar(session.pillars) : null;
  const nextRitual = session ? suggestNextRitual(session.completedRituals) : null;

  const streakHint = useMemo(
    () =>
      session && session.score >= 60
        ? 'Great serotonin day. Keep the streak tomorrow.'
        : 'Complete pillars and rituals to improve your score.',
    [session],
  );

  return (
    <Theme name="dark">
      <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$7" gap="$5">
        <PageHeader
          eyebrow="Planificacion"
          title="Calendario de productividad"
          description="Tus horarios de trabajo y descanso son la base: crea tareas desde un bloque de trabajo, registra fitness desde un descanso, y el bloqueo de distracciones se activa automaticamente durante el trabajo."
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
            <YStack data-tutorial="tasks-header">
              <TaskManager />
            </YStack>
            <SuggestionsPreview />
            <YStack data-tutorial="serotonin-mode">
              {session ? (
                <SerotoninModePanel
                  session={session}
                  nextPillar={nextPillar}
                  nextRitual={nextRitual}
                  streakHint={streakHint}
                  onRitual={onRitual}
                  onPillar={onPillar}
                  onMood={onMood}
                  pillarLabels={PILLAR_LABELS}
                  ritualLabels={RITUAL_LABELS}
                  moodLabels={MOOD_LABELS}
                  allRituals={DISPLAYABLE_RITUALS}
                  allMoods={MOOD_STATES}
                />
              ) : (
                <StatusCard tone="loading" message="Cargando bienestar diario..." />
              )}
            </YStack>
          </YStack>
        </XStack>
      </YStack>
    </Theme>
  );
}
