import type { DetoxPlan, DetoxScheduleProposal } from '@calendar/shared';
import { INTENSITY_LABELS, proposeDetoxSchedules } from '@calendar/shared';
import { AppButton, AppCard, H3, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import type { ScheduleFormValues } from '../../lib/schedules/types';
import { minuteToTimeValue } from '../../lib/schedules/types';

interface DetoxScheduleProposalsProps {
  plan: DetoxPlan;
  isBusy: boolean;
  onApplyProposal: (values: ScheduleFormValues) => Promise<void>;
}

function toFormValues(proposal: DetoxScheduleProposal): ScheduleFormValues {
  return {
    kind: proposal.kind,
    dayOfWeek: proposal.dayOfWeek,
    startMinute: proposal.startMinute,
    endMinute: proposal.endMinute,
    label: proposal.label,
    enabled: true,
  };
}

export function DetoxScheduleProposals({ plan, isBusy, onApplyProposal }: DetoxScheduleProposalsProps) {
  const proposals = proposeDetoxSchedules(plan);

  if (!proposals.length) {
    return null;
  }

  return (
    <AppCard>
      <YStack gap="$3">
        <YStack gap="$1">
          <H3 margin={0}>Horarios sugeridos para esta fase</H3>
          <Paragraph margin={0} color="$muted">
            Bloques de trabajo y descanso diferenciados por intensidad, alineados con tu dia actual del plan de
            desintoxicacion.
          </Paragraph>
        </YStack>

        <YStack gap="$3">
          {proposals.map((proposal, index) => (
            <AppCard key={`${proposal.label}-${index}`} backgroundColor="rgba(255,255,255,0.03)">
              <YStack gap="$2">
                <XStack justifyContent="space-between" alignItems="flex-start" gap="$2" flexWrap="wrap">
                  <YStack gap="$1" flex={1}>
                    <Text fontWeight="700">{proposal.label}</Text>
                    <Text color="$muted" fontSize="$2">
                      {proposal.kind === 'WORK' ? 'Trabajo' : 'Descanso'} · {INTENSITY_LABELS[proposal.intensity]}
                    </Text>
                  </YStack>
                  <Text color="$muted" fontSize="$2">
                    {minuteToTimeValue(proposal.startMinute)} – {minuteToTimeValue(proposal.endMinute)}
                  </Text>
                </XStack>
                <Paragraph margin={0} color="$muted" size="$2">
                  {proposal.reason}
                </Paragraph>
                <AppButton
                  type="button"
                  variant="ghost"
                  disabled={isBusy}
                  onPress={() => void onApplyProposal(toFormValues(proposal))}
                >
                  Aplicar horario
                </AppButton>
              </YStack>
            </AppCard>
          ))}
        </YStack>
      </YStack>
    </AppCard>
  );
}
