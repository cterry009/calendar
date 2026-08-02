import { useMemo, useState } from 'react';
import { Theme } from 'tamagui';
import {
  MOOD_LABELS,
  MOOD_STATES,
  PILLAR_LABELS,
  RITUAL_LABELS,
  SEROTONIN_RITUALS,
  type MoodState,
  type SerotoninPillar,
  type SerotoninRitual,
  type SerotoninSession,
  completeRitual,
  createSerotoninSession,
  endSerotoninSession,
  logMood,
  logPillarActivity,
  suggestNextPillar,
  suggestNextRitual,
} from '@calendar/shared';
import { AppButton, AppCard, XStack, YStack } from '@calendar/ui';
import { CalendarPanel } from '../components/calendar/CalendarPanel';
import { MiniMonthCalendar } from '../components/calendar/MiniMonthCalendar';
import { PageHeader } from '../components/PageHeader';
import type { CalendarViewMode } from '../lib/calendar/types';
import { startOfDay } from '../lib/calendar/utils';
import { ScheduleManager } from '../components/schedules/ScheduleManager';
import { TaskManager } from '../components/tasks/TaskManager';
import { SerotoninModePanel } from '../components/SerotoninModePanel';
import { SuggestionsPreview } from '../components/suggestions/SuggestionsPreview';

export function CalendarPage() {
  const [session, setSession] = useState<SerotoninSession | null>(null);
  const [mode, setMode] = useState<CalendarViewMode>('week');
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));

  const calmMode = session?.active ?? false;
  const nextPillar = session ? suggestNextPillar(session.pillars) : null;
  const nextRitual = session ? suggestNextRitual(session.completedRituals) : null;

  const streakHint = useMemo(
    () =>
      session && session.score >= 60
        ? 'Great serotonin day. Keep the streak tomorrow.'
        : 'Complete pillars and rituals to improve your score.',
    [session],
  );

  function startMode() {
    setSession(createSerotoninSession(crypto.randomUUID()));
  }

  function stopMode() {
    if (session) setSession(endSerotoninSession(session));
  }

  function handleRitual(ritual: SerotoninRitual) {
    if (!session) return;
    setSession(completeRitual(session, ritual));
  }

  function handlePillar(pillar: SerotoninPillar, minutes: number) {
    if (!session) return;
    setSession(logPillarActivity(session, pillar, minutes));
  }

  function handleMood(mood: MoodState) {
    if (!session) return;
    setSession(logMood(session, mood));
  }

  return (
    <Theme name={calmMode ? 'calm' : 'dark'}>
      <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$7" gap="$5">
        <PageHeader
          eyebrow="Planificacion"
          title="Calendario de productividad"
          description="Tus horarios de trabajo y descanso son la base: crea tareas desde un bloque de trabajo, registra fitness desde un descanso, y el bloqueo de distracciones se activa automaticamente durante el trabajo."
          tutorialId="calendar-hero"
          maxWidth={700}
          actions={
            !session?.active ? (
              <AppButton variant="primary" onPress={startMode}>
                Activate Serotonin Mode
              </AppButton>
            ) : (
              <AppButton variant="ghost" onPress={stopMode}>
                End mode
              </AppButton>
            )
          }
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
              <SerotoninModePanel
                session={session}
                nextPillar={nextPillar}
                nextRitual={nextRitual}
                streakHint={streakHint}
                onRitual={handleRitual}
                onPillar={handlePillar}
                onMood={handleMood}
                pillarLabels={PILLAR_LABELS}
                ritualLabels={RITUAL_LABELS}
                moodLabels={MOOD_LABELS}
                allRituals={SEROTONIN_RITUALS}
                allMoods={MOOD_STATES}
              />
            </YStack>
          </YStack>
        </XStack>
      </YStack>
    </Theme>
  );
}
