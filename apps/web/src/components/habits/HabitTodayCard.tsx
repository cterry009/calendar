import { useState } from 'react';
import { AppButton, Text, XStack, YStack } from '@calendar/ui';
import { Input } from 'tamagui';
import type { HabitWithScore } from '../../hooks/useHabits';
import { withAlpha } from '../../lib/habits/labels';
import { computeCurrentStreak, findRecordForDate, todayKey } from '../../lib/habits/today';
import type { HabitCheckInValues, SyncHabitRecord } from '../../lib/habits/types';

interface HabitTodayCardProps {
  habit: HabitWithScore;
  records: SyncHabitRecord[];
  isBusy: boolean;
  onCheckIn: (values: HabitCheckInValues) => Promise<void>;
  onSkip: (reason: string) => Promise<void>;
  onRemoveCheckIn: (recordId: string) => Promise<void>;
  onOpenDetail: () => void;
}

const SKIP_REASONS = ['☕ Sin tiempo', '😴 Cansado/a', '🤒 Enfermo/a', '📱 Me distraje'];

export function HabitTodayCard({
  habit,
  records,
  isBusy,
  onCheckIn,
  onSkip,
  onRemoveCheckIn,
  onOpenDetail,
}: HabitTodayCardProps) {
  const today = todayKey();
  const record = findRecordForDate(records, habit.id, today);
  const streak = computeCurrentStreak(habit.id, records, today);
  const baseColor = habit.color ?? '#4ee0a0';

  const [expanded, setExpanded] = useState(false);
  const [value, setValue] = useState(String(record?.value ?? habit.dailyGoalValue));
  const [skipReason, setSkipReason] = useState('');
  const [showSkip, setShowSkip] = useState(false);

  const isDone = record?.status === 'DONE';
  const isSkipped = record?.status === 'SKIPPED';
  const needsValue = habit.dailyGoalValue !== 1;
  const progressPct = Math.min(100, (Number(value) || 0) / Math.max(habit.dailyGoalValue, 0.0001) * 100);

  async function markDoneAtGoal() {
    if (needsValue) {
      setExpanded((current) => !current);
      return;
    }
    await onCheckIn({ date: today, value: habit.dailyGoalValue, status: 'DONE' });
  }

  async function confirmValue() {
    const parsed = Number(value);
    await onCheckIn({ date: today, value: Number.isFinite(parsed) ? parsed : habit.dailyGoalValue, status: 'DONE' });
    setExpanded(false);
  }

  async function confirmSkip() {
    await onSkip(skipReason);
    setShowSkip(false);
    setSkipReason('');
  }

  return (
    <YStack
      backgroundColor="$surface"
      borderRadius="$4"
      borderWidth={1}
      borderColor="$borderColor"
      overflow="hidden"
    >
      <XStack alignItems="center" gap="$3" padding="$4" cursor="pointer" onPress={onOpenDetail}>
        <YStack flex={1} minWidth={0} gap="$1">
          <Text fontSize="$5">{habit.title}</Text>
          <Text fontSize="$2" color="$muted">
            {streak > 0 ? `Racha: ${streak} dia${streak === 1 ? '' : 's'}` : `Score ${Math.round(habit.score)}`}
          </Text>
        </YStack>

        <YStack
          width={44}
          height={44}
          borderRadius="$3"
          alignItems="center"
          justifyContent="center"
          backgroundColor={withAlpha(baseColor, isDone ? 0.28 : isSkipped ? 0.12 : 0.16)}
          cursor="pointer"
          onPress={(event: { stopPropagation: () => void }) => {
            event.stopPropagation();
            void markDoneAtGoal();
          }}
          aria-label="Marcar hecho"
        >
          <Text fontSize="$6" color={baseColor}>
            {isDone ? '✓' : isSkipped ? '✕' : '○'}
          </Text>
        </YStack>
      </XStack>

      {expanded ? (
        <YStack paddingHorizontal="$4" paddingBottom="$4" gap="$3">
          <XStack alignItems="center" gap="$2">
            <Input flex={1} value={value} onChangeText={setValue} keyboardType="numeric" aria-label="Valor de hoy" />
            <Text color="$muted" fontSize="$2">
              / {habit.dailyGoalValue} {habit.dailyGoalUnit}
            </Text>
          </XStack>

          <YStack height={8} borderRadius="$10" backgroundColor="rgba(255,255,255,0.08)" overflow="hidden">
            <YStack height={8} width={`${progressPct}%`} backgroundColor={baseColor} />
          </YStack>

          <XStack gap="$2" justifyContent="flex-end">
            <AppButton type="button" variant="ghost" onPress={() => setExpanded(false)}>
              Cerrar
            </AppButton>
            <AppButton type="button" variant="primary" disabled={isBusy} onPress={() => void confirmValue()}>
              Guardar
            </AppButton>
          </XStack>
        </YStack>
      ) : null}

      <XStack paddingHorizontal="$4" paddingBottom="$3" gap="$3">
        <AppButton type="button" variant="ghost" disabled={isBusy} onPress={() => setShowSkip((current) => !current)}>
          Omitir
        </AppButton>
        {record ? (
          <AppButton type="button" variant="ghost" disabled={isBusy} onPress={() => void onRemoveCheckIn(record.id)}>
            Quitar registro
          </AppButton>
        ) : null}
      </XStack>

      {showSkip ? (
        <YStack paddingHorizontal="$4" paddingBottom="$4" gap="$2" borderTopWidth={1} borderColor="$borderColor" paddingTop="$3">
          <Text fontSize="$2" color="$muted">
            Motivo (opcional)
          </Text>
          <XStack gap="$2" flexWrap="wrap">
            {SKIP_REASONS.map((reason) => (
              <AppButton
                key={reason}
                type="button"
                variant={skipReason === reason ? 'primary' : 'ghost'}
                onPress={() => setSkipReason(reason)}
              >
                {reason}
              </AppButton>
            ))}
          </XStack>
          <XStack gap="$2" justifyContent="flex-end">
            <AppButton type="button" variant="ghost" onPress={() => setShowSkip(false)}>
              Cancelar
            </AppButton>
            <AppButton type="button" variant="primary" disabled={isBusy} onPress={() => void confirmSkip()}>
              Confirmar omision
            </AppButton>
          </XStack>
        </YStack>
      ) : null}
    </YStack>
  );
}
