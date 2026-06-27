import type { Suggestion } from '@calendar/shared';
import { useMemo, useState } from 'react';
import { AppButton, AppCard, Paragraph, XStack, YStack } from '@calendar/ui';
import {
  SUGGESTION_PRIORITY_FILTER_LABELS,
  type SuggestionPriorityFilter,
} from '../../lib/analytics/suggestion-labels';
import { SuggestionCard } from './SuggestionCard';

interface SuggestionsPanelProps {
  suggestions: Suggestion[];
}

const FILTERS: SuggestionPriorityFilter[] = ['ALL', 'high', 'medium', 'low'];

function priorityRank(priority: Suggestion['priority']) {
  if (priority === 'high') {
    return 3;
  }
  if (priority === 'medium') {
    return 2;
  }
  return 1;
}

export function SuggestionsPanel({ suggestions }: SuggestionsPanelProps) {
  const [filter, setFilter] = useState<SuggestionPriorityFilter>('ALL');

  const filteredSuggestions = useMemo(() => {
    const base = filter === 'ALL' ? suggestions : suggestions.filter((item) => item.priority === filter);
    return [...base].sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));
  }, [filter, suggestions]);

  return (
    <YStack gap="$4">
      <XStack gap="$2" flexWrap="wrap">
        {FILTERS.map((value) => (
          <AppButton
            key={value}
            type="button"
            variant={filter === value ? 'primary' : 'ghost'}
            onPress={() => setFilter(value)}
          >
            {SUGGESTION_PRIORITY_FILTER_LABELS[value]}
          </AppButton>
        ))}
      </XStack>

      {filteredSuggestions.length === 0 ? (
        <AppCard>
          <Paragraph margin={0} color="$muted">
            No hay sugerencias para este filtro todavia. Genera datos de ejemplo o continua registrando sesiones.
          </Paragraph>
        </AppCard>
      ) : (
        <YStack gap="$3">
          {filteredSuggestions.map((suggestion, index) => (
            <SuggestionCard
              key={`${suggestion.kind}-${suggestion.priority}-${index}`}
              suggestion={suggestion}
            />
          ))}
        </YStack>
      )}
    </YStack>
  );
}
