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
import {
  AppButton,
  AppCard,
  Eyebrow,
  H1,
  H2,
  Paragraph,
  XStack,
  YStack,
} from '@calendar/ui';
import { SerotoninModePanel } from './components/SerotoninModePanel';

export default function App() {
  const [session, setSession] = useState<SerotoninSession | null>(null);

  const calmMode = session?.active ?? false;
  const nextPillar = session ? suggestNextPillar(session.pillars) : null;
  const nextRitual = session ? suggestNextRitual(session.completedRituals) : null;

  const streakHint = useMemo(
    () =>
      session && session.score >= 60
        ? '¡Buen día serotoninérgico! Mantén la racha mañana.'
        : 'Completa pilares y rituales para subir tu puntuación.',
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
      <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$7">
        <XStack
          justifyContent="space-between"
          alignItems="flex-start"
          gap="$6"
          marginBottom="$7"
          flexWrap="wrap"
        >
          <YStack flex={1} maxWidth={640}>
            <Eyebrow>Calendar Productivity</Eyebrow>
            <H1 fontSize="$9" marginBottom="$2">
              Calendario inteligente + Modo Serotonina
            </H1>
            <Paragraph color="$muted" size="$5">
              Reduce estímulos digitales de alta dopamina y promueve actividades que apoyan tu
              equilibrio natural (luz solar, ejercicio, conexión social, meditación).
            </Paragraph>
          </YStack>
          {!session?.active ? (
            <AppButton variant="primary" onPress={startMode}>
              Activar Modo Serotonina
            </AppButton>
          ) : (
            <AppButton variant="ghost" onPress={stopMode}>
              Finalizar modo
            </AppButton>
          )}
        </XStack>

        <XStack gap="$6" flexWrap="wrap" alignItems="flex-start">
          <AppCard flex={1} minWidth={280} maxWidth={420}>
            <H2 fontSize="$6" marginTop={0}>
              Próximamente
            </H2>
            <YStack gap="$2" paddingLeft="$3">
              <Paragraph color="$muted">• Calendario con tareas (dificultad, complejidad, estimación)</Paragraph>
              <Paragraph color="$muted">• Pomodoros y bloqueo de distracciones</Paragraph>
              <Paragraph color="$muted">• Estadísticas de productividad y deporte</Paragraph>
              <Paragraph color="$muted">• Sync móvil + escritorio</Paragraph>
            </YStack>
          </AppCard>

          <YStack flex={1.4} minWidth={320}>
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
        </XStack>
      </YStack>
    </Theme>
  );
}
