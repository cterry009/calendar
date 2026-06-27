import type { DetoxPlan } from '@calendar/shared';
import { getDetoxDayPlan, isDetoxDayComplete } from '@calendar/shared';
import { AppButton, AppCard, H3, Paragraph, Text, XStack, YStack } from '@calendar/ui';

interface DetoxDayChecklistProps {
  plan: DetoxPlan;
  isBusy: boolean;
  onToggleItem: (day: number, itemId: string) => Promise<void>;
  onCompleteDay: (day: number) => Promise<void>;
}

export function DetoxDayChecklist({ plan, isBusy, onToggleItem, onCompleteDay }: DetoxDayChecklistProps) {
  const dayPlan = getDetoxDayPlan(plan);
  if (!dayPlan) {
    return null;
  }

  const completed = new Set(plan.completedChecklistItems[dayPlan.day] ?? []);
  const dayComplete = isDetoxDayComplete(plan, dayPlan.day);

  return (
    <AppCard>
      <YStack gap="$4">
        <YStack gap="$1">
          <Text color="$muted">Dia {dayPlan.day}</Text>
          <H3 margin={0}>{dayPlan.title}</H3>
          <Paragraph margin={0} color="$muted">
            {dayPlan.goal}
          </Paragraph>
        </YStack>

        <YStack gap="$2">
          {dayPlan.checklist.map((item) => {
            const checked = completed.has(item.id);
            return (
              <XStack key={item.id} gap="$3" alignItems="center">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={isBusy}
                  onChange={() => void onToggleItem(dayPlan.day, item.id)}
                />
                <Text color={checked ? '$muted' : '$color'}>{item.label}</Text>
              </XStack>
            );
          })}
        </YStack>

        <AppButton
          type="button"
          variant="primary"
          disabled={!dayComplete || isBusy || plan.completedDays.includes(dayPlan.day)}
          onPress={() => void onCompleteDay(dayPlan.day)}
        >
          {plan.completedDays.includes(dayPlan.day)
            ? 'Dia completado'
            : dayComplete
              ? 'Marcar dia como completado'
              : 'Completa los items requeridos'}
        </AppButton>
      </YStack>
    </AppCard>
  );
}
