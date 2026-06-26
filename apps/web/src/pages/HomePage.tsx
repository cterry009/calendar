import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { AppButton, AppCard, Eyebrow, H1, H2, Paragraph, XStack, YStack } from '@calendar/ui';
import { OnboardingTutorial } from '../components/onboarding/OnboardingTutorial';
import { SerotoninModePanel } from '../components/SerotoninModePanel';
import { useAuth } from '../context/AuthContext';
import { isTutorialCompleted, markTutorialCompleted } from '../lib/onboarding/storage';

export function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<SerotoninSession | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    if (user && !isTutorialCompleted()) {
      setShowTutorial(true);
    }
  }, [user]);

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

  function handleFinishTutorial() {
    markTutorialCompleted();
    setShowTutorial(false);
  }

  function handleSkipTutorial() {
    markTutorialCompleted();
    setShowTutorial(false);
  }

  return (
    <Theme name={calmMode ? 'calm' : 'dark'}>
      <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$7">
        <OnboardingTutorial open={showTutorial} onFinish={handleFinishTutorial} onSkip={handleSkipTutorial} />

        <XStack justifyContent="space-between" alignItems="center" gap="$4" marginBottom="$5" flexWrap="wrap">
          <YStack>
            <Eyebrow>Authenticated session</Eyebrow>
            <Paragraph color="$muted">{user?.email ?? 'Unknown user'}</Paragraph>
          </YStack>
          <XStack gap="$2" flexWrap="wrap">
            <AppButton variant="ghost" onPress={() => setShowTutorial(true)}>
              Ver tutorial
            </AppButton>
            <AppButton variant="ghost" onPress={logout}>
              Logout
            </AppButton>
          </XStack>
        </XStack>

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
              Smart calendar + Serotonin Mode
            </H1>
            <Paragraph color="$muted" size="$5">
              Reduce high-dopamine digital stimuli and promote activities that support natural balance
              such as sunlight, exercise, social connection, and meditation.
            </Paragraph>
          </YStack>
          {!session?.active ? (
            <AppButton variant="primary" onPress={startMode}>
              Activate Serotonin Mode
            </AppButton>
          ) : (
            <AppButton variant="ghost" onPress={stopMode}>
              End mode
            </AppButton>
          )}
        </XStack>

        <XStack gap="$6" flexWrap="wrap" alignItems="flex-start">
          <AppCard flex={1} minWidth={280} maxWidth={420}>
            <H2 fontSize="$6" marginTop={0}>
              Calendario
            </H2>
            <YStack gap="$2" marginBottom="$4">
              <Paragraph color="$muted" margin={0}>
                Vistas dia/semana/mes con tareas, bloques de trabajo, descansos y pomodoros.
              </Paragraph>
              <Paragraph color="$muted" margin={0}>
                Resumen semanal de horas estimadas y densidad mensual de eventos.
              </Paragraph>
            </YStack>
            <AppButton variant="primary" onPress={() => navigate('/calendar')}>
              Ir al calendario
            </AppButton>
          </AppCard>

          <AppCard flex={1} minWidth={280} maxWidth={420}>
            <H2 fontSize="$6" marginTop={0}>
              Tareas
            </H2>
            <YStack gap="$2" marginBottom="$4">
              <Paragraph color="$muted" margin={0}>
                Gestiona tareas con dificultad, prioridad, complejidad y estimaciones de tiempo.
              </Paragraph>
              <Paragraph color="$muted" margin={0}>
                Completa tareas registrando minutos reales para mejorar tus estimaciones.
              </Paragraph>
            </YStack>
            <AppButton variant="primary" onPress={() => navigate('/tasks')}>
              Ir a tareas
            </AppButton>
          </AppCard>

          <AppCard flex={1} minWidth={280} maxWidth={420}>
            <H2 fontSize="$6" marginTop={0}>
              Pomodoro
            </H2>
            <YStack gap="$2" marginBottom="$4">
              <Paragraph color="$muted" margin={0}>
                Activa ciclos de enfoque y descanso vinculados a tareas pendientes o en progreso.
              </Paragraph>
              <Paragraph color="$muted" margin={0}>
                Configura duraciones, revisa estado actual y recibe avisos al terminar cada fase.
              </Paragraph>
            </YStack>
            <AppButton variant="primary" onPress={() => navigate('/pomodoro')}>
              Abrir pomodoro
            </AppButton>
          </AppCard>

          <AppCard flex={1} minWidth={280} maxWidth={420}>
            <H2 fontSize="$6" marginTop={0}>
              Horarios
            </H2>
            <YStack gap="$2" marginBottom="$4">
              <Paragraph color="$muted" margin={0}>
                Configura horarios recurrentes de trabajo y descansos para cada dia de la semana.
              </Paragraph>
              <Paragraph color="$muted" margin={0}>
                Estos bloques se sincronizan y aparecen en calendario junto con tus tareas.
              </Paragraph>
            </YStack>
            <AppButton variant="primary" onPress={() => navigate('/schedule')}>
              Configurar horarios
            </AppButton>
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
