import { useNavigate } from 'react-router-dom';
import { AppButton, AppCard, H2, Paragraph, Text, YStack } from '@calendar/ui';
import { useSuggestions } from '../../hooks/useSuggestions';
import { SUGGESTION_PRIORITY_LABELS } from '../../lib/analytics/suggestion-labels';

export function SuggestionsPreview() {
  const navigate = useNavigate();
  const { suggestions, isLoading, error } = useSuggestions();
  const topSuggestions = suggestions.slice(0, 3);

  return (
    <AppCard flex={1} minWidth={280} maxWidth={420}>
      <YStack gap="$3">
        <H2 fontSize="$6" marginTop={0}>
          Sugerencias
        </H2>

        {error ? (
          <Paragraph margin={0} color="$error">
            {error}
          </Paragraph>
        ) : null}

        {isLoading ? (
          <Paragraph margin={0} color="$muted">
            Cargando sugerencias...
          </Paragraph>
        ) : topSuggestions.length === 0 ? (
          <Paragraph margin={0} color="$muted">
            Aun no hay sugerencias. Completa tareas o genera datos de ejemplo.
          </Paragraph>
        ) : (
          <YStack gap="$2">
            {topSuggestions.map((item, index) => (
              <YStack key={`${item.kind}-${index}`} gap="$1" padding="$2" borderRadius="$3" backgroundColor="rgba(255,255,255,0.03)">
                <Text fontWeight="700">{item.title}</Text>
                <Text color="$muted" fontSize="$2">
                  Prioridad {SUGGESTION_PRIORITY_LABELS[item.priority]}
                </Text>
              </YStack>
            ))}
          </YStack>
        )}

        <AppButton type="button" variant="ghost" onPress={() => navigate('/suggestions')}>
          Ver todas las sugerencias
        </AppButton>
      </YStack>
    </AppCard>
  );
}
