import { useState } from 'react';
import { AppButton, XStack, YStack } from '@calendar/ui';
import { EveningShutdown } from '../components/ritual/EveningShutdown';
import { MorningReview } from '../components/ritual/MorningReview';
import { PageHeader } from '../components/PageHeader';
import { StatusCard } from '../components/StatusCard';
import { useDailyRitual } from '../hooks/useDailyRitual';
import { useSerotoninSession } from '../context/SerotoninSessionContext';

type RitualTab = 'morning' | 'evening';

function defaultTab(): RitualTab {
  return new Date().getHours() < 14 ? 'morning' : 'evening';
}

export function RitualPage() {
  const [tab, setTab] = useState<RitualTab>(defaultTab);
  const { onRitual } = useSerotoninSession();
  const { state, isLoading, markMorningDone, markEveningDone, reopenMorning, reopenEvening } = useDailyRitual();

  async function handleMorningComplete() {
    onRitual('morning_review');
    await markMorningDone();
  }

  async function handleEveningComplete(reflection: string) {
    onRitual('evening_shutdown');
    await markEveningDone(reflection);
  }

  return (
    <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$7" gap="$5">
      <PageHeader
        eyebrow="Ritual diario"
        title="Revision matutina y cierre nocturno"
        description="Planea el dia con un horario concreto para cada tarea, y ciérralo marcando lo que avanzaste. Es el mecanismo real de disciplina de la app: planes si-entonces, no fuerza de voluntad."
      />

      <XStack gap="$2">
        <AppButton variant={tab === 'morning' ? 'primary' : 'ghost'} onPress={() => setTab('morning')}>
          Manana
        </AppButton>
        <AppButton variant={tab === 'evening' ? 'primary' : 'ghost'} onPress={() => setTab('evening')}>
          Noche
        </AppButton>
      </XStack>

      {isLoading ? (
        <StatusCard tone="loading" message="Cargando ritual de hoy..." />
      ) : tab === 'morning' ? (
        state.morningCompletedAt ? (
          <YStack gap="$3">
            <StatusCard tone="info" message="Ya completaste tu revision matutina de hoy." />
            <XStack>
              <AppButton variant="ghost" onPress={reopenMorning}>
                Revisar de nuevo
              </AppButton>
            </XStack>
          </YStack>
        ) : (
          <MorningReview onComplete={() => void handleMorningComplete()} />
        )
      ) : state.eveningCompletedAt ? (
        <YStack gap="$3">
          <StatusCard tone="info" message="Ya completaste tu cierre nocturno de hoy." />
          <XStack>
            <AppButton variant="ghost" onPress={reopenEvening}>
              Revisar de nuevo
            </AppButton>
          </XStack>
        </YStack>
      ) : (
        <EveningShutdown initialReflection={state.reflection ?? ''} onComplete={(reflection) => void handleEveningComplete(reflection)} />
      )}
    </YStack>
  );
}
