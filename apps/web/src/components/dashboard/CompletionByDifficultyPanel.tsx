import { AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import type { DifficultyCompletionMetric } from '../../lib/analytics/types';

interface CompletionByDifficultyPanelProps {
  items: DifficultyCompletionMetric[];
}

const LABELS = {
  EASY: 'Faciles',
  MEDIUM: 'Medias',
  HARD: 'Dificiles',
} as const;

export function CompletionByDifficultyPanel({ items }: CompletionByDifficultyPanelProps) {
  return (
    <AppCard>
      <YStack gap="$4">
        <YStack gap="$1">
          <H2 margin={0} fontSize="$6">
            Completado por dificultad
          </H2>
          <Paragraph color="$muted" margin={0}>
            Proporcion de tareas completadas por nivel de dificultad.
          </Paragraph>
        </YStack>

        <YStack gap="$3">
          {items.map((item) => (
            <YStack key={item.difficulty} gap="$1">
              <XStack justifyContent="space-between" alignItems="center">
                <Text>{LABELS[item.difficulty]}</Text>
                <Text color="$muted">
                  {item.completed}/{item.total} ({item.completionRate}%)
                </Text>
              </XStack>
              <YStack height={10} borderRadius="$2" backgroundColor="rgba(255,255,255,0.08)">
                <YStack
                  height="100%"
                  width={`${Math.max(0, Math.min(100, item.completionRate))}%`}
                  borderRadius="$2"
                  backgroundColor="$accent"
                />
              </YStack>
            </YStack>
          ))}
        </YStack>
      </YStack>
    </AppCard>
  );
}
