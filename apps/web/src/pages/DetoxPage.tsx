import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PILLAR_LABELS, RITUAL_LABELS, getDetoxDayPlan } from '@calendar/shared';
import { AppButton, AppCard, Eyebrow, H1, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { BaselineAuditForm } from '../components/detox/BaselineAuditForm';
import { DetoxDayChecklist } from '../components/detox/DetoxDayChecklist';
import { DetoxPhaseProgress } from '../components/detox/DetoxPhaseProgress';
import { DetoxScheduleProposals } from '../components/detox/DetoxScheduleProposals';
import { useDetoxPlan } from '../hooks/useDetoxPlan';
import { useSchedules } from '../hooks/useSchedules';
import { useSyncStatusMessage } from '../hooks/useSyncRefetch';

export function DetoxPage() {
  const navigate = useNavigate();
  const syncStatus = useSyncStatusMessage();
  const { plan, isLoading, startPlan, saveBaselineAudit, toggleChecklistItem, completeDay, resetPlan } =
    useDetoxPlan();
  const { createSchedule, isMutating } = useSchedules();
  const [isSavingAudit, setIsSavingAudit] = useState(false);

  const dayPlan = plan ? getDetoxDayPlan(plan) : null;
  const needsBaselineAudit = plan?.currentDay === 1 && !plan.baselineAudit;

  async function handleStartPlan() {
    await startPlan();
  }

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
      <XStack justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap="$4">
        <YStack maxWidth={760} data-tutorial="detox-header">
          <Eyebrow>Bienestar digital</Eyebrow>
          <H1 marginTop={0} marginBottom="$2">
            Plan de desintoxicacion serotoninergica
          </H1>
          <Paragraph color="$muted" margin={0}>
            Programa de 7 dias con fases de auditoria, reduccion selectiva, reintroduccion con limites y
            mantenimiento. Conecta con el Modo Serotonina y horarios de intensidad diferenciada.
          </Paragraph>
        </YStack>

        <XStack gap="$2" flexWrap="wrap">
          <AppButton type="button" variant="ghost" onPress={() => navigate('/')}>
            Inicio
          </AppButton>
          <AppButton type="button" variant="ghost" onPress={() => navigate('/schedule')}>
            Horarios
          </AppButton>
        </XStack>
      </XStack>

      {syncStatus ? (
        <AppCard>
          <Paragraph margin={0} color="$muted">
            {syncStatus}
          </Paragraph>
        </AppCard>
      ) : null}

      {isLoading ? (
        <AppCard>
          <Paragraph margin={0}>Cargando plan...</Paragraph>
        </AppCard>
      ) : !plan ? (
        <AppCard>
          <YStack gap="$3">
            <Paragraph margin={0}>
              Aun no has iniciado el plan. Incluye checklist diaria, progreso por fase y horarios sugeridos segun
              la intensidad de cada etapa.
            </Paragraph>
            <AppButton type="button" variant="primary" onPress={() => void handleStartPlan()}>
              Iniciar plan de 7 dias
            </AppButton>
          </YStack>
        </AppCard>
      ) : (
        <YStack gap="$5">
          <DetoxPhaseProgress plan={plan} />

          {needsBaselineAudit ? (
            <BaselineAuditForm isSubmitting={isSavingAudit} onSubmit={handleAudit} />
          ) : (
            <>
              <DetoxDayChecklist
                plan={plan}
                isBusy={isSavingAudit}
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

              <DetoxScheduleProposals plan={plan} isBusy={isMutating} onApplyProposal={createSchedule} />
            </>
          )}

          <XStack gap="$2" flexWrap="wrap">
            <AppButton type="button" variant="ghost" onPress={() => void resetPlan()}>
              Reiniciar plan
            </AppButton>
          </XStack>
        </YStack>
      )}
    </YStack>
  );
}
