import type { DetoxPlan } from '@calendar/shared';
import { DETOX_PHASES, getDetoxDayPlan } from '@calendar/shared';
import { AppCard, H3, Paragraph, Text, XStack, YStack } from '@calendar/ui';

const PHASE_LABELS: Record<(typeof DETOX_PHASES)[number], string> = {
  audit: 'Auditoria',
  reduction: 'Reduccion',
  reintroduction: 'Reintroduccion',
  maintenance: 'Mantenimiento',
};

interface DetoxPhaseProgressProps {
  plan: DetoxPlan;
}

export function DetoxPhaseProgress({ plan }: DetoxPhaseProgressProps) {
  const currentDayPlan = getDetoxDayPlan(plan);

  return (
    <AppCard>
      <YStack gap="$3">
        <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$2">
          <H3 margin={0}>Progreso del plan</H3>
          <Text color="$muted">{plan.progressPercent}% completado</Text>
        </XStack>

        <YStack height={8} backgroundColor="rgba(255,255,255,0.08)" borderRadius={999} overflow="hidden">
          <YStack height="100%" width={`${plan.progressPercent}%`} backgroundColor="$primary" />
        </YStack>

        <XStack gap="$2" flexWrap="wrap">
          {DETOX_PHASES.map((phase) => {
            const isActive = currentDayPlan?.phase === phase;
            return (
              <AppCard
                key={phase}
                padding="$2"
                backgroundColor={isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'}
              >
                <Text fontSize="$2" color={isActive ? '$color' : '$muted'}>
                  {PHASE_LABELS[phase]}
                </Text>
              </AppCard>
            );
          })}
        </XStack>

        <Paragraph margin={0} color="$muted">
          Dia {plan.currentDay} de {plan.durationDays}
          {currentDayPlan ? ` · Fase ${PHASE_LABELS[currentDayPlan.phase]}` : ''}
        </Paragraph>
      </YStack>
    </AppCard>
  );
}
