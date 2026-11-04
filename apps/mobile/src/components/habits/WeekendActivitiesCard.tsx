import { AppButton, AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { useMemo, useState } from 'react';
import { Input } from 'tamagui';
import { WEEKEND_ACTIVITY_DAILY_CAP, checkWeekendActivity, isWeekendActivity } from '@calendar/shared';
import { findRecordForDate, todayKey } from '../../lib/habits/today';
import type { HabitFormValues, SyncHabit, SyncHabitRecord } from '../../lib/habits/types';

interface WeekendActivitiesCardProps {
  habits: SyncHabit[];
  records: SyncHabitRecord[];
  isBusy: boolean;
  onCreate: (values: HabitFormValues) => Promise<void>;
  onDelete: (habitId: string) => void;
  onDone: (habitId: string) => void;
}

const DAYS = [
  { day: 6, label: 'Sábado' },
  { day: 0, label: 'Domingo' },
];

function hhmm(minute: number | null): string {
  if (minute === null) return '';
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

// Weekend activities (weekend-mode): reminders for things to do on Saturday or Sunday, 3 a day at
// most. Habits underneath (useHabitReminders.ts notifies at the time), but with their own card.
export function WeekendActivitiesCard({ habits, records, isBusy, onCreate, onDelete, onDone }: WeekendActivitiesCardProps) {
  const [title, setTitle] = useState('');
  const [day, setDay] = useState(6);
  const [time, setTime] = useState('10:00');
  const [error, setError] = useState<string | null>(null);
  const activities = useMemo(() => habits.filter((h) => isWeekendActivity(h) && !h.archived), [habits]);
  const today = new Date().getDay();

  async function add() {
    const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (!title.trim()) return setError('Escribe la actividad.');
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return setError('La hora va como HH:MM, por ejemplo 10:00.');
    const minute = Number(match[1]) * 60 + Number(match[2]);
    const fits = checkWeekendActivity(habits, { kind: 'WEEKEND_ACTIVITY', reminderDaysOfWeek: [day] });
    if (!fits.ok) return setError(fits.error);
    setError(null);
    await onCreate({
      kind: 'WEEKEND_ACTIVITY',
      title,
      description: null,
      type: 'NORMAL',
      dailyGoalValue: 1,
      dailyGoalUnit: 'veces',
      dailyGoalExtraValue: null,
      targetDays: 66,
      color: null,
      category: null,
      linkedFitnessActivityType: null,
      reminderEndMinute: minute,
      reminderDaysOfWeek: [day],
    });
    setTitle('');
  }

  return (
    <AppCard>
      <YStack gap="$3">
        <YStack gap="$1">
          <H2 margin={0} fontSize="$5">
            Fin de semana
          </H2>
          <Paragraph margin={0} color="$muted">
            Recordatorios de actividades, máximo {WEEKEND_ACTIVITY_DAILY_CAP} por día. Te avisa a la hora, cada semana.
          </Paragraph>
        </YStack>

        {DAYS.map(({ day: rowDay, label }) => {
          const ofDay = activities
            .filter((a) => a.reminderDaysOfWeek.includes(rowDay))
            .sort((a, b) => (a.reminderEndMinute ?? 0) - (b.reminderEndMinute ?? 0));
          return (
            <YStack key={rowDay} gap="$1">
              <Text fontWeight="700" fontSize="$3">
                {label} · {ofDay.length}/{WEEKEND_ACTIVITY_DAILY_CAP}
              </Text>
              {ofDay.length === 0 ? (
                <Text color="$muted" fontSize="$2">
                  Nada todavía.
                </Text>
              ) : null}
              {ofDay.map((activity) => {
                const done = rowDay === today && findRecordForDate(records, activity.id, todayKey())?.status === 'DONE';
                return (
                  <XStack key={activity.id} alignItems="center" gap="$2" justifyContent="space-between">
                    <Text flex={1} fontSize="$3">
                      {hhmm(activity.reminderEndMinute)} {activity.title}
                    </Text>
                    {rowDay === today ? (
                      <AppButton variant={done ? 'primary' : 'ghost'} paddingHorizontal="$2" disabled={isBusy || done} onPress={() => onDone(activity.id)}>
                        {done ? 'Hecha' : 'Hecho'}
                      </AppButton>
                    ) : null}
                    <AppButton variant="ghost" paddingHorizontal="$2" disabled={isBusy} onPress={() => onDelete(activity.id)}>
                      <Text color="$danger" fontSize="$2">
                        Quitar
                      </Text>
                    </AppButton>
                  </XStack>
                );
              })}
            </YStack>
          );
        })}

        <YStack gap="$2" paddingTop="$2" borderTopWidth={1} borderTopColor="$borderColor">
          <Input value={title} onChangeText={setTitle} placeholder="Lavar la ropa, llamar a la familia..." />
          <XStack gap="$2" alignItems="center" flexWrap="wrap">
            {DAYS.map((option) => (
              <AppButton key={option.day} variant={day === option.day ? 'primary' : 'ghost'} onPress={() => setDay(option.day)}>
                {option.label}
              </AppButton>
            ))}
            <Input value={time} onChangeText={setTime} placeholder="10:00" width={84} />
            <AppButton variant="primary" disabled={isBusy} onPress={() => void add()}>
              Agregar
            </AppButton>
          </XStack>
          {error ? (
            <Text color="$danger" fontSize="$2">
              {error}
            </Text>
          ) : null}
        </YStack>
      </YStack>
    </AppCard>
  );
}
