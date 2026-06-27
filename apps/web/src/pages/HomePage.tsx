import { useMemo, useState } from 'react';
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
import { SerotoninModePanel } from '../components/SerotoninModePanel';
import { SuggestionsPreview } from '../components/suggestions/SuggestionsPreview';
import { useAuth } from '../context/AuthContext';
import { useOnboarding } from '../context/OnboardingContext';
import { usePomodoro } from '../context/PomodoroContext';
import { useSoftFocus } from '../context/SoftFocusContext';

export function HomePage() {
  const { user, logout } = useAuth();
  const { openTutorial } = useOnboarding();
  const pomodoro = usePomodoro();
  const softFocus = useSoftFocus();
  const navigate = useNavigate();
  const [session, setSession] = useState<SerotoninSession | null>(null);

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
      <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$7">
        <XStack justifyContent="space-between" alignItems="center" gap="$4" marginBottom="$5" flexWrap="wrap">
          <YStack>
            <Eyebrow>Authenticated session</Eyebrow>
            <Paragraph color="$muted">{user?.email ?? 'Unknown user'}</Paragraph>
          </YStack>
          <XStack gap="$2" flexWrap="wrap">
            <AppButton variant="ghost" onPress={openTutorial}>
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
          <YStack flex={1} maxWidth={640} data-tutorial="home-hero">
            <Eyebrow>Calendar Productivity</Eyebrow>
            <H1 fontSize="$9" marginBottom="$2">
              Smart calendar + Serotonin Mode
            </H1>
            <Paragraph color="$muted" size="$5">
              Reduce high-dopamine digital stimuli and promote activities that support natural balance such as
              sunlight, exercise, social connection, and meditation.
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
              Fitness
            </H2>
            <YStack gap="$2" marginBottom="$4">
              <Paragraph color="$muted" margin={0}>
                Registra entrenamientos manuales con tipo de actividad, duracion e intensidad.
              </Paragraph>
              <Paragraph color="$muted" margin={0}>
                Revisa resumen diario y semanal para detectar consistencia y volumen por actividad.
              </Paragraph>
            </YStack>
            <AppButton variant="primary" onPress={() => navigate('/fitness')}>
              Ir a fitness
            </AppButton>
          </AppCard>

          <AppCard flex={1} minWidth={280} maxWidth={420}>
            <H2 fontSize="$6" marginTop={0}>
              Dashboard
            </H2>
            <YStack gap="$2" marginBottom="$4">
              <Paragraph color="$muted" margin={0}>
                Visualiza tareas y pomodoros de la semana actual frente a la anterior con barras simples.
              </Paragraph>
              <Paragraph color="$muted" margin={0}>
                Incluye precision de estimaciones, horas de foco y correlacion fitness-productividad.
              </Paragraph>
            </YStack>
            <AppButton variant="primary" onPress={() => navigate('/dashboard')}>
              Ir al dashboard
            </AppButton>
          </AppCard>

          <SuggestionsPreview />

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
              <Paragraph color="$muted" margin={0}>
                El overlay de enfoque web es un recordatorio visual y no aplica bloqueo del sistema operativo.
              </Paragraph>
            </YStack>
            <XStack gap="$2" flexWrap="wrap">
              <AppButton variant="primary" onPress={() => navigate('/pomodoro')}>
                Abrir pomodoro
              </AppButton>
              <AppButton
                variant="ghost"
                onPress={() => softFocus.startManualFocus(25)}
                disabled={pomodoro.isBlocking || softFocus.manualSoftFocus.active}
              >
                Enfoque manual 25 min
              </AppButton>
            </XStack>
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

          <AppCard flex={1} minWidth={280} maxWidth={420}>
            <H2 fontSize="$6" marginTop={0}>
              Lista de bloqueo
            </H2>
            <YStack gap="$2" marginBottom="$4">
              <Paragraph color="$muted" margin={0}>
                Configura apps, sitios y programas a bloquear durante foco, pomodoros o modo serotonina.
              </Paragraph>
              <Paragraph color="$muted" margin={0}>
                Se sincroniza entre dispositivos para que Android y escritorio apliquen las mismas reglas.
              </Paragraph>
            </YStack>
            <AppButton variant="primary" onPress={() => navigate('/blocklist')}>
              Gestionar distracciones
            </AppButton>
          </AppCard>

          <AppCard flex={1} minWidth={280} maxWidth={420}>
            <H2 fontSize="$6" marginTop={0}>
              Plan detox
            </H2>
            <YStack gap="$2" marginBottom="$4">
              <Paragraph color="$muted" margin={0}>
                Programa de 7 dias para reducir estimulos digitales de alta dopamina con checklist diaria.
              </Paragraph>
              <Paragraph color="$muted" margin={0}>
                Incluye horarios sugeridos por intensidad vinculados a cada fase del plan.
              </Paragraph>
            </YStack>
            <AppButton variant="primary" onPress={() => navigate('/detox')}>
              Ir al plan detox
            </AppButton>
          </AppCard>

          <YStack flex={1.4} minWidth={320} data-tutorial="serotonin-mode">
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

