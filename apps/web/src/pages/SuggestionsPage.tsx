import { AppButton, Paragraph, YStack } from '@calendar/ui';
import { PageHeader } from '../components/PageHeader';
import { StatusCard } from '../components/StatusCard';
import { SuggestionsPanel } from '../components/suggestions/SuggestionsPanel';
import { useSuggestions } from '../hooks/useSuggestions';

export function SuggestionsPage() {
  const { suggestions, isLoading, isSeeding, error, syncedAt, refetch, seedDemo } = useSuggestions();

  async function handleSeedDemo() {
    await seedDemo();
  }

  return (
    <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$7" gap="$5">
      <PageHeader
        eyebrow="Analitica"
        title="Sugerencias de mejora"
        description="Recomendaciones accionables generadas con tus tareas completadas y sesiones de pomodoro reales."
        maxWidth={780}
        actions={
          <>
            <AppButton type="button" variant="primary" onPress={() => void handleSeedDemo()} disabled={isLoading || isSeeding}>
              {isSeeding ? 'Generando datos...' : 'Generar datos de ejemplo'}
            </AppButton>
            <AppButton type="button" variant="ghost" onPress={() => void refetch()} disabled={isLoading || isSeeding}>
              {isLoading ? 'Cargando...' : 'Refrescar'}
            </AppButton>
          </>
        }
      />

      {error ? <StatusCard tone="error" message={error} /> : null}

      {isLoading ? (
        <StatusCard tone="loading" message="Cargando sugerencias..." />
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
