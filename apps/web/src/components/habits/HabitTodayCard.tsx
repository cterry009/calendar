import { useState } from 'react';
import { AppButton, AppCard, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { Input } from 'tamagui';
import { HABIT_TYPE_LABELS } from '../../lib/habits/labels';
import { findRecordForDate, todayKey } from '../../lib/habits/today';
import type { HabitCheckInValues, SyncHabitRecord } from '../../lib/habits/types';
import type { HabitWithScore } from '../../hooks/useHabits';

interface HabitTodayCardProps {
  habit: HabitWithScore;
  records: SyncHabitRecord[];
  isBusy: boolean;
  onCheckIn: (values: HabitCheckInValues) => Promise<void>;
  onRemoveCheckIn: (recordId: string) => Promise<void>;
  onOpenDetail: () => void;
}

export function HabitTodayCard({
  habit,
  records,
  isBusy,
  onCheckIn,
  onRemoveCheckIn,
  onOpenDetail,
}: HabitTodayCardProps) {
  const today = todayKey();
  const record = findRecordForDate(records, habit.id, today);
  const [value, setValue] = useState(String(record?.value ?? habit.dailyGoalValue));

  async function markDone() {
    const parsed = Number(value);
    await onCheckIn({
      date: today,
      value: Number.isFinite(parsed) ? parsed : habit.dailyGoalValue,
      status: 'DONE',
    });
  }

  async function markSkipped() {
    await onCheckIn({ date: today, value: 0, status: 'SKIPPED' });
  }

  return (
    <AppCard>
      <YStack gap="$3">
        <XStack justifyContent="space-between" alignItems="flex-start" gap="$3" flexWrap="wrap">
          <YStack flex={1} minWidth={160} gap="$1" cursor="pointer" onPress={onOpenDetail}>
            <XStack alignItems="center" gap="$2">
              <YStack width={10} height={10} borderRadius={999} backgroundColor={habit.color ?? '#4ee0a0'} />
              <Paragraph size="$5" margin={0}>
                {habit.title}
              </Paragraph>
            </XStack>
            <Text fontSize="$2" color="$muted">
              {HABIT_TYPE_LABELS[habit.type]} · meta: {habit.dailyGoalValue} {habit.dailyGoalUnit}
            </Text>
          </YStack>

          <Text fontSize="$3" color="$muted">
            score {Math.round(habit.score)}
          </Text>
        </XStack>

        <XStack gap="$2" alignItems="center" flexWrap="wrap">
          <Input
            width={80}
            value={value}
            onChangeText={setValue}
            keyboardType="numeric"
            aria-label="Valor de hoy"
          />
          <AppButton type="button" variant={record?.status === 'DONE' ? 'primary' : 'ghost'} disabled={isBusy} onPress={() => void markDone()}>
            Marcar hecho
          </AppButton>
          <AppButton type="button" variant={record?.status === 'SKIPPED' ? 'primary' : 'ghost'} disabled={isBusy} onPress={() => void markSkipped()}>
            Omitir
          </AppButton>
          {record ? (
            <AppButton type="button" variant="ghost" disabled={isBusy} onPress={() => void onRemoveCheckIn(record.id)}>
              Quitar
            </AppButton>
          ) : null}
        </XStack>
      </YStack>
    </AppCard>
  );
}
