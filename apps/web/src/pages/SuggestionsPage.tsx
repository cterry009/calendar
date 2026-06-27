import { useNavigate } from 'react-router-dom';
import { AppButton, AppCard, Eyebrow, H1, Paragraph, XStack, YStack } from '@calendar/ui';
import { SuggestionsPanel } from '../components/suggestions/SuggestionsPanel';
import { useSuggestions } from '../hooks/useSuggestions';

export function SuggestionsPage() {
  const navigate = useNavigate();
  const { suggestions, isLoading, isSeeding, error, syncedAt, refetch, seedDemo } = useSuggestions();

  async function handleSeedDemo() {
    await seedDemo();
  }

  return (
    <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$7" gap="$5">
      <XStack justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap="$4">
        <YStack maxWidth={780}>
          <Eyebrow>Analitica</Eyebrow>
          <H1 marginTop={0} marginBottom="$2">
            Sugerencias de mejora
          </H1>
          <Paragraph color="$muted" margin={0}>
            Recomendaciones accionables generadas con tus tareas completadas y sesiones de pomodoro reales.
          </Paragraph>
        </YStack>
        <XStack gap="$2" flexWrap="wrap">
          <AppButton type="button" variant="ghost" onPress={() => navigate('/dashboard')}>
            Dashboard
          </AppButton>
          <AppButton type="button" variant="ghost" onPress={() => navigate('/')}>
            Inicio
          </AppButton>
        </XStack>
      </XStack>

      <XStack gap="$2" flexWrap="wrap">
        <AppButton type="button" variant="primary" onPress={() => void handleSeedDemo()} disabled={isLoading || isSeeding}>
          {isSeeding ? 'Generando datos...' : 'Generar datos de ejemplo'}
        </AppButton>
        <AppButton type="button" variant="ghost" onPress={() => void refetch()} disabled={isLoading || isSeeding}>
          {isLoading ? 'Cargando...' : 'Refrescar'}
        </AppButton>
      </XStack>

      {error ? (
        <AppCard>
          <Paragraph margin={0} color="$error">
            {error}
          </Paragraph>
        </AppCard>
      ) : null}

      {isLoading ? (
        <AppCard>
          <Paragraph margin={0}>Cargando sugerencias...</Paragraph>
        </AppCard>
      ) : (
        <SuggestionsPanel suggestions={suggestions} />
      )}

      {syncedAt ? (
        <Paragraph size="$2" color="$muted" margin={0}>
          Ultima sincronizacion: {new Date(syncedAt).toLocaleString('es-ES')}
        </Paragraph>
      ) : null}
    </YStack>
  );
}
