import { useMemo, useState } from 'react';
import {
  MOOD_LABELS,
  MOOD_STATES,
  PILLAR_LABELS,
  RITUAL_LABELS,
  SEROTONIN_RITUALS,
  suggestNextPillar,
  suggestNextRitual,
  type SerotoninRitual,
} from '@calendar/shared';
import { YStack } from '@calendar/ui';
import { FrictionOverlay } from '../components/friction/FrictionOverlay';
import { PageHeader } from '../components/PageHeader';
import { SerotoninModePanel } from '../components/SerotoninModePanel';
import { StatusCard } from '../components/StatusCard';
import { useLanguage } from '../context/LanguageContext';
import { useSerotoninSession } from '../context/SerotoninSessionContext';

// morning_review/evening_shutdown complete through the dedicated Ritual panel's guided flow,
// not a bare "Completar" button, so they're excluded from this generic ritual card list.
const DISPLAYABLE_RITUALS = SEROTONIN_RITUALS.filter(
  (ritual) => ritual !== 'morning_review' && ritual !== 'evening_shutdown',
);

export function WellnessPage() {
  const { t } = useLanguage();
  const { session, onRitual, onPillar, onMood } = useSerotoninSession();
  const [showBreathingFriction, setShowBreathingFriction] = useState(false);

  const nextPillar = session ? suggestNextPillar(session.pillars) : null;
  const nextRitual = session ? suggestNextRitual(session.completedRituals) : null;

  function handleRitual(ritual: SerotoninRitual) {
    // "breathing" gets a real enforced pause instead of an instant tap, via the
    // shared FrictionOverlay reused from the focus-blocking exit flow.
    if (ritual === 'breathing') {
      setShowBreathingFriction(true);
      return;
    }
    onRitual(ritual);
  }

  const streakHint = useMemo(
    () => (session && session.score >= 60 ? t('calendarHub.streakHint.good') : t('calendarHub.streakHint.default')),
    [session, t],
  );

  return (
    <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$7" gap="$5">
      <PageHeader
        eyebrow={t('wellness.eyebrow')}
        title={t('wellness.title')}
        description={t('wellness.description')}
      />

      {session ? (
        <SerotoninModePanel
          session={session}
          nextPillar={nextPillar}
          nextRitual={nextRitual}
          streakHint={streakHint}
          onRitual={handleRitual}
          onPillar={onPillar}
          onMood={onMood}
          pillarLabels={PILLAR_LABELS}
          ritualLabels={RITUAL_LABELS}
          moodLabels={MOOD_LABELS}
          allRituals={DISPLAYABLE_RITUALS}
          allMoods={MOOD_STATES}
        />
      ) : (
        <StatusCard tone="loading" message="Cargando bienestar diario..." />
      )}

      <FrictionOverlay
        visible={showBreathingFriction}
        title={RITUAL_LABELS.breathing.title}
        description={RITUAL_LABELS.breathing.description}
        cycles={4}
        onCancel={() => setShowBreathingFriction(false)}
        onComplete={() => {
          setShowBreathingFriction(false);
          onRitual('breathing');
        }}
        completeLabel="Marcar como completa"
        cancelLabel="Cancelar"
      />
    </YStack>
  );
}
