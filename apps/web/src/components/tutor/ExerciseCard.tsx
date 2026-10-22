import { AppButton, Text, XStack, YStack } from '@calendar/ui';
import type { TutorExercise } from '../../lib/studyGame/tutorApi';
import { Markdown } from './Markdown';

const KIND_BADGE: Record<string, { label: string; color: string }> = {
  vf: { label: 'Verdadero o falso', color: '#5aa9e6' },
  sencillo: { label: '🟢 Sencillo', color: '#4caf82' },
  medio: { label: '🟡 Medio', color: '#e0b64c' },
  dificil: { label: '🔴 Difícil · jefe', color: '#e8705a' },
  muy_dificil: { label: '⚫ Muy difícil · jefe', color: '#9aa3a0' },
  generado: { label: '✨ Generado por el tutor', color: '#b48ce6' },
};

export function kindBadge(exercise: Pick<TutorExercise, 'kind' | 'source'>) {
  return KIND_BADGE[exercise.source === 'generado' ? 'generado' : (exercise.kind ?? 'medio')];
}

/**
 * The exercise on the table (study-tutor-game D40): its kind and statement. The reference answer
 * is never shown here; Claude shows it when it grades.
 */
export function ExerciseCard({
  exercise,
  disabled,
  onShortcut,
}: {
  exercise: TutorExercise;
  disabled: boolean;
  onShortcut: (message: string) => void;
}) {
  const badge = kindBadge(exercise);
  return (
    <YStack
      gap="$2"
      padding="$3"
      borderRadius="$4"
      borderWidth={1}
      borderColor={badge.color}
      backgroundColor="$surfaceHover"
    >
      <XStack justifyContent="space-between" alignItems="center" gap="$2" flexWrap="wrap">
        <Text
          fontSize="$2"
          fontWeight="700"
          color={badge.color}
          textTransform="uppercase"
          letterSpacing={0.5}
        >
          {badge.label}
          {exercise.title ? ` — ${exercise.title}` : ''}
        </Text>
        <Text fontSize="$1" color="$muted">
          {exercise.exerciseId}
        </Text>
      </XStack>
      <Markdown text={exercise.statement} />
      <XStack gap="$2" flexWrap="wrap">
        <AppButton
          variant="ghost"
          disabled={disabled}
          onPress={() => onShortcut('Dame una pista, por favor.')}
        >
          Pista
        </AppButton>
        <AppButton
          variant="ghost"
          disabled={disabled}
          onPress={() =>
            onShortcut('No sé cómo resolverlo. ¿Me lo explicas y lo calificas como no resuelto?')
          }
        >
          No sé
        </AppButton>
        <AppButton
          variant="ghost"
          disabled={disabled}
          onPress={() => onShortcut('Explícame la idea principal de esta sección antes de seguir.')}
        >
          Explícame la sección
        </AppButton>
      </XStack>
    </YStack>
  );
}
