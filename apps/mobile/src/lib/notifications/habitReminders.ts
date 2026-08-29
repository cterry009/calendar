import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { SyncHabit } from '../habits/types';
import { HABIT_CONFIRMATION_CATEGORY } from './habitCategory';

// 0=Sunday..6=Saturday, matches this app's existing Schedule.daysOfWeek/reminderDaysOfWeek
// convention (JS Date.getDay()) -- expo-notifications' WEEKLY trigger uses 1=Sunday..7=Saturday,
// converted at the call site below.
const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

// One id for the "every day" shape, one per weekday for a partial-week habit -- deterministic
// from the habit id alone, so a reschedule can cancel exactly the right ones without keeping a
// separate id->habit map anywhere.
function dailyIdentifier(habitId: string): string {
  return `habit-reminder-${habitId}`;
}

function weeklyIdentifier(habitId: string, weekday: number): string {
  return `habit-reminder-${habitId}-${weekday}`;
}

async function cancelHabitReminders(habitId: string): Promise<void> {
  const ids = [dailyIdentifier(habitId), ...ALL_WEEKDAYS.map((day) => weeklyIdentifier(habitId, day))];
  await Promise.all(
    ids.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => {
        // Cancelling an id that was never scheduled is expected (most habits use only one of the
        // two shapes) -- not an error worth surfacing.
      }),
    ),
  );
}

type ReminderHabit = Pick<SyncHabit, 'id' | 'title' | 'reminderEndMinute' | 'reminderDaysOfWeek'>;

// Cancels any previously scheduled reminder for this habit, then reschedules from its current
// reminderEndMinute/reminderDaysOfWeek -- safe to call on every habits refetch (idempotent), which
// is how useHabitReminders.ts drives it rather than diffing what changed.
export async function scheduleHabitReminder(habit: ReminderHabit): Promise<void> {
  if (Platform.OS !== 'android') return;

  await cancelHabitReminders(habit.id);
  if (habit.reminderEndMinute == null) return;

  const hour = Math.floor(habit.reminderEndMinute / 60);
  const minute = habit.reminderEndMinute % 60;
  const content: Notifications.NotificationContentInput = {
    title: habit.title,
    body: 'Se cumplio hoy?',
    categoryIdentifier: HABIT_CONFIRMATION_CATEGORY,
    data: { habitId: habit.id },
  };

  const days = habit.reminderDaysOfWeek.length ? habit.reminderDaysOfWeek : ALL_WEEKDAYS;

  if (days.length === 7) {
    await Notifications.scheduleNotificationAsync({
      identifier: dailyIdentifier(habit.id),
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
    });
    return;
  }

  await Promise.all(
    days.map((day) =>
      Notifications.scheduleNotificationAsync({
        identifier: weeklyIdentifier(habit.id, day),
        content,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: day + 1, hour, minute },
      }),
    ),
  );
}

export async function cancelAllHabitReminders(habitId: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  await cancelHabitReminders(habitId);
}
