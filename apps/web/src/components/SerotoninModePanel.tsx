import type {
  MoodState,
  SerotoninPillar,
  SerotoninRitual,
  SerotoninSession,
} from '@calendar/shared';
import {
  AppButton,
  AppCard,
  H2,
  H3,
  Paragraph,
  ScoreDisplay,
  Text,
  XStack,
  YStack,
} from '@calendar/ui';

interface Props {
  session: SerotoninSession | null;
  nextPillar: SerotoninPillar | null;
  nextRitual: SerotoninRitual | null;
  streakHint: string;
  onRitual: (ritual: SerotoninRitual) => void;
  onPillar: (pillar: SerotoninPillar, minutes: number) => void;
  onMood: (mood: MoodState) => void;
  pillarLabels: Record<SerotoninPillar, string>;
  ritualLabels: Record<SerotoninRitual, { title: string; durationMin: number; description: string }>;
  moodLabels: Record<MoodState, string>;
  allRituals: readonly SerotoninRitual[];
  allMoods: readonly MoodState[];
}

export function SerotoninModePanel({
  session,
  nextPillar,
  nextRitual,
  streakHint,
  onRitual,
  onPillar,
  onMood,
  pillarLabels,
  ritualLabels,
  moodLabels,
  allRituals,
  allMoods,
}: Props) {
  if (!session) {
    return (
      <AppCard variant="serotonin" opacity={0.9}>
        <H2 fontSize="$6" marginTop={0}>
          Modo Control de Serotonina
        </H2>
        <Paragraph color="$muted">
          Activa el modo para bloquear distracciones (en móvil/escritorio), seguir 6 pilares de
          bienestar y completar rituales breves de calma.
        </Paragraph>
      </AppCard>
    );
  }

  return (
    <AppCard variant="serotonin">
      <XStack justifyContent="space-between" alignItems="center" gap="$4" marginBottom="$4">
        <YStack flex={1}>
          <H2 fontSize="$6" marginTop={0}>
            Modo Serotonina activo
          </H2>
          <Paragraph color="$muted" size="$3">
            {streakHint}
          </Paragraph>
        </YStack>
        <XStack alignItems="baseline" gap="$1" aria-label="Puntuación serotonina">
          <ScoreDisplay>{session.score}</ScoreDisplay>
          <Text color="$muted">/ 100</Text>
        </XStack>
      </XStack>

      {nextPillar && (
        <YStack
          backgroundColor="$accentBackground"
          padding="$4"
          borderRadius="$3"
          marginBottom="$4"
        >
          <Paragraph size="$4">
            Sugerencia: dedica 15 min a{' '}
            <Text fontWeight="700">{pillarLabels[nextPillar]}</Text>
          </Paragraph>
        </YStack>
      )}

      <H3 fontSize="$5" color="$muted" marginBottom="$3">
        Pilares de presencia
      </H3>
      <YStack gap="$3" marginBottom="$5">
        {session.pillars.map((p) => (
          <XStack
            key={p.pillar}
            alignItems="center"
            gap="$3"
            padding="$3"
            borderRadius="$3"
            backgroundColor="rgba(0,0,0,0.2)"
            borderLeftWidth={p.completed ? 3 : 0}
            borderLeftColor="$success"
          >
            <Text flex={1}>{pillarLabels[p.pillar]}</Text>
            <Text color="$muted" fontSize="$3">
              {p.minutes}/{p.targetMinutes} min
            </Text>
            {!p.completed && session.active && (
              <AppButton variant="small" onPress={() => onPillar(p.pillar, 15)}>
                +15 min
              </AppButton>
            )}
          </XStack>
        ))}
      </YStack>

      <H3 fontSize="$5" color="$muted" marginBottom="$3">
        Rituales guiados
      </H3>
      <YStack gap="$3" marginBottom="$5">
        {allRituals.map((ritual) => {
          const meta = ritualLabels[ritual];
          const done = session.completedRituals.includes(ritual);
          return (
            <YStack
              key={ritual}
              gap="$2"
              padding="$3"
              borderRadius="$3"
              backgroundColor="rgba(0,0,0,0.2)"
              borderLeftWidth={done ? 3 : 0}
              borderLeftColor="$success"
            >
              <XStack justifyContent="space-between">
                <Text fontWeight="700">{meta.title}</Text>
                <Text color="$muted" fontSize="$3">
                  {meta.durationMin} min
                </Text>
              </XStack>
              <Paragraph color="$muted" size="$3" margin={0}>
                {meta.description}
              </Paragraph>
              {!done && session.active && (
                <AppButton
                  variant={nextRitual === ritual ? 'primary' : 'small'}
                  alignSelf="flex-start"
                  onPress={() => onRitual(ritual)}
                >
                  Completar
                </AppButton>
              )}
            </YStack>
          );
        })}
      </YStack>

      <H3 fontSize="$5" color="$muted" marginBottom="$3">
        Check-in de ánimo
      </H3>
      <XStack gap="$2" flexWrap="wrap">
        {allMoods.map((mood) => (
          <AppButton
            key={mood}
            variant="mood"
            disabled={!session.active}
            onPress={() => onMood(mood)}
          >
            {moodLabels[mood]}
          </AppButton>
        ))}
      </XStack>
    </AppCard>
  );
}
