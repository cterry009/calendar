import { useState } from 'react';
import { PILLAR_LABELS, RITUAL_LABELS, getDetoxDayPlan } from '@calendar/shared';
import { AppButton, AppCard, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { BaselineAuditForm } from '../components/detox/BaselineAuditForm';
import { DetoxDayChecklist } from '../components/detox/DetoxDayChecklist';
import { DetoxPhaseProgress } from '../components/detox/DetoxPhaseProgress';
import { DetoxScheduleProposals } from '../components/detox/DetoxScheduleProposals';
import { PageHeader } from '../components/PageHeader';
import { StatusCard } from '../components/StatusCard';
import { useDetoxPlan } from '../hooks/useDetoxPlan';
import { useSchedules } from '../hooks/useSchedules';
import { useSyncStatusMessage } from '../hooks/useSyncRefetch';

export function DetoxPage() {
  const syncStatus = useSyncStatusMessage();
  const { plan, isLoading, isMutating, error, saveBaselineAudit, toggleChecklistItem, completeDay, resetPlan } =
    useDetoxPlan();
  const { createSchedule, isMutating: isScheduleMutating } = useSchedules();
  const [isSavingAudit, setIsSavingAudit] = useState(false);
  const isBusy = isMutating || isSavingAudit || isScheduleMutating;

  const dayPlan = plan ? getDetoxDayPlan(plan) : null;
  const needsBaselineAudit = plan?.currentDay === 1 && !plan.baselineAudit;

  async function handleAudit(screenTimeHoursEstimate: number, topDistractions: string[]) {
    setIsSavingAudit(true);
    try {
      await saveBaselineAudit(screenTimeHoursEstimate, topDistractions);
    } finally {
      setIsSavingAudit(false);
    }
  }

  return (
    <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$7" gap="$5">
      <PageHeader
        eyebrow="Bienestar digital"
        title="Plan de desintoxicacion serotoninergica"
        description="Programa de 7 dias con fases de auditoria, reduccion selectiva, reintroduccion con limites y mantenimiento. Conecta con el Modo Serotonina y horarios de intensidad diferenciada."
        tutorialId="detox-header"
      />

      {syncStatus ? <StatusCard tone="muted" message={syncStatus} /> : null}

      {error ? <StatusCard tone="error" message={error} /> : null}

      {isLoading || !plan ? (
        <StatusCard tone="loading" message="Preparando tu plan de 7 dias..." />
      ) : (
        <YStack gap="$5">
          <YStack data-tutorial="detox-progress">
            <DetoxPhaseProgress plan={plan} />
          </YStack>

          {needsBaselineAudit ? (
            <BaselineAuditForm isSubmitting={isSavingAudit} onSubmit={handleAudit} />
          ) : (
            <>
              <DetoxDayChecklist
                plan={plan}
                isBusy={isBusy}
                onToggleItem={toggleChecklistItem}
                onCompleteDay={completeDay}
              />

              {dayPlan ? (
                <AppCard>
                  <YStack gap="$2">
                    <Text fontWeight="700">Rituales sugeridos</Text>
                    <Paragraph margin={0} color="$muted">
                      {dayPlan.suggestedRituals.map((ritual) => RITUAL_LABELS[ritual].title).join(' · ')}
                    </Paragraph>
                    <Text fontWeight="700" marginTop="$2">
                      Pilares objetivo
                    </Text>
                    <Paragraph margin={0} color="$muted">
                      {dayPlan.pillarTargets.map((pillar) => PILLAR_LABELS[pillar]).join(' · ')}
                    </Paragraph>
                  </YStack>
                </AppCard>
              ) : null}

              <DetoxScheduleProposals plan={plan} isBusy={isBusy} onApplyProposal={createSchedule} />
            </>
          )}

          <XStack gap="$2" flexWrap="wrap">
            <AppButton type="button" variant="ghost" onPress={() => void resetPlan()} disabled={isBusy}>
              Reiniciar plan
            </AppButton>
          </XStack>
        </YStack>
      )}
    </YStack>
  );
}
