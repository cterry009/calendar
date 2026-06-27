import type { Suggestion } from '@calendar/shared';
import { AppCard, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import {
  SUGGESTION_KIND_LABELS,
  SUGGESTION_PRIORITY_BADGE_COLORS,
  SUGGESTION_PRIORITY_LABELS,
} from '../../lib/analytics/suggestion-labels';

interface SuggestionCardProps {
  suggestion: Suggestion;
}

export function SuggestionCard({ suggestion }: SuggestionCardProps) {
  return (
    <AppCard>
      <YStack gap="$2">
        <XStack gap="$2" flexWrap="wrap">
          <Text
            fontSize="$2"
            borderRadius="$10"
            paddingHorizontal="$3"
            paddingVertical="$1"
            backgroundColor="rgba(255,255,255,0.08)"
            color="$muted"
          >
            {SUGGESTION_KIND_LABELS[suggestion.kind]}
          </Text>
          <Text
            fontSize="$2"
            borderRadius="$10"
            paddingHorizontal="$3"
            paddingVertical="$1"
            backgroundColor="rgba(255,255,255,0.08)"
            color={SUGGESTION_PRIORITY_BADGE_COLORS[suggestion.priority]}
            fontWeight="700"
          >
            Prioridad {SUGGESTION_PRIORITY_LABELS[suggestion.priority]}
          </Text>
        </XStack>
        <Paragraph margin={0} fontSize="$6">
          {suggestion.title}
        </Paragraph>
        <Paragraph margin={0} color="$muted">
          {suggestion.message}
        </Paragraph>
      </YStack>
    </AppCard>
  );
}
