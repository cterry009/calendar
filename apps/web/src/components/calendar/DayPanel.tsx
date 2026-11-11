import { useState } from 'react';
import { localDateKey } from '@calendar/shared';
import { AppButton, Text, XStack, YStack } from '@calendar/ui';
import { useCalendarData } from '../../hooks/useCalendarData';
import { useTasks } from '../../hooks/useTasks';
import { buildCheckInPayload, buildDeleteCheckInPayload } from '../../lib/habits/sync';
import { syncBatch } from '../../lib/offline/sync-client';
import { useQuickAdd } from '../../context/QuickAddContext';
import { ProgressBar } from '../agenda/parts';

// 2026-11-10: what the old Hoy page had, inside the calendar's Día view -- the day's habits with quick
// amounts and its tasks to tick; the blocks themselves are the calendar.

const Title = ({ children }: { children: string }) => (
  <Text fontSize={12} fontWeight="700" letterSpacing={1.2} color="$muted" textTransform="uppercase">
    {children}
  </Text>
);

export function DayPanel({ date }: { date: Date }) {
  const data = useCalendarData();
  const { tasks, completeTask, isMutating } = useTasks();
  const { open: openQuickAdd } = useQuickAdd();
  const [busy, setBusy] = useState<string | null>(null);
  const key = localDateKey(date);
  const isToday = key === localDateKey(new Date());

  const dayTasks = tasks.filter((t) => t.status !== 'COMPLETED' && t.scheduledAt && localDateKey(new Date(t.scheduledAt)) === key);
  const highNoDate = isToday ? tasks.filter((t) => t.status !== 'COMPLETED' && !t.scheduledAt && t.priority === 'HIGH') : [];
  const habits = data.habits.filter((h) => !h.archived);
  const recordOf = (id: string) => data.habitRecords.find((r) => r.habitId === id && r.date.slice(0, 10) === key);

  async function setHabit(habitId: string, value: number) {
    const record = recordOf(habitId);
    setBusy(habitId);
    try {
      const change = value <= 0 ? (record ? buildDeleteCheckInPayload(record.id) : null) : buildCheckInPayload(habitId, { date: key, value, status: 'DONE' }, record?.id);
      if (change) await syncBatch({ habitRecords: [change] });
      await data.refetch();
    } finally {
      setBusy(null);
    }
  }

  const taskRow = (t: (typeof tasks)[number]) => (
    <XStack key={t.id} gap="$2" alignItems="center">
      <input
        type="checkbox"
        checked={false}
        disabled={isMutating}
        aria-label={`Completar ${t.title}`}
        style={{ width: 16, height: 16 }}
        onChange={async () => {
          await completeTask(t, t.estimatedMinutes);
          await data.refetch();
        }}
      />
      <Text flex={1} fontSize="$3">
        {t.title}
      </Text>
      {t.priority === 'HIGH' ? (
        <Text fontSize={11} color="$danger">
          alta
        </Text>
      ) : null}
    </XStack>
  );

  return (
    <YStack width={300} flexShrink={0} gap="$4" padding="$4" borderWidth={1} borderColor="$borderColor" borderRadius="$4" backgroundColor="$surface" alignSelf="flex-start">
      <YStack gap="$2">
        <XStack justifyContent="space-between" alignItems="center">
          <Title>Tareas</Title>
          <AppButton variant="ghost" size="$2" onPress={openQuickAdd}>
            + Tarea
          </AppButton>
        </XStack>
        {dayTasks.length === 0 && highNoDate.length === 0 ? (
          <Text fontSize="$2" color="$muted">
            Sin tareas para este día.
          </Text>
        ) : null}
        {dayTasks.map(taskRow)}
        {highNoDate.length ? (
          <>
            <Text fontSize="$2" color="$muted">
              Prioridad alta sin fecha
            </Text>
            {highNoDate.slice(0, 5).map(taskRow)}
          </>
        ) : null}
      </YStack>
      {isToday ? (
        <YStack gap="$2">
          <Title>Hábitos de hoy</Title>
          {habits.map((h) => {
            const value = recordOf(h.id)?.value ?? 0;
            const goal = h.dailyGoalValue || 1;
            const pct = h.type === 'NEGATIVE' ? (value <= goal ? 100 : 0) : Math.round((value / goal) * 100);
            return (
              <YStack key={h.id} gap={4}>
                <XStack gap="$2" alignItems="center">
                  <Text flex={1} fontSize="$3" numberOfLines={1}>
                    {h.title}
                  </Text>
                  <Text fontSize="$2" color="$muted">
                    {value}/{goal}
                  </Text>
                  <AppButton size="$2" variant="ghost" disabled={busy === h.id} onPress={() => void setHabit(h.id, value + (goal >= 10 ? Math.round(goal / 4) : 1))}>
                    +
                  </AppButton>
                </XStack>
                <ProgressBar value={pct} color={h.color} />
              </YStack>
            );
          })}
        </YStack>
      ) : null}
    </YStack>
  );
}
