import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { HABIT_CONFIRM_YES_ACTION, ensureHabitConfirmationCategory } from '../lib/notifications/habitCategory';
import { cancelAllHabitReminders, scheduleHabitReminder } from '../lib/notifications/habitReminders';
import { todayKey } from '../lib/habits/today';
import type { HabitCheckInValues } from '../lib/habits/types';
import { useHabits } from './useHabits';

// Task 11.6. Mounted once at the app root (same bridge pattern as FocusBlockingBridge/
// JogDetectionBridge in _layout.tsx) so there's a single useHabits() instance driving both the
// reschedule effect and the notification-response listener, instead of every screen that happens
// to render duplicating the work.
export function useHabitReminders(): void {
  const { habits, checkIn } = useHabits();
  const checkInRef = useRef(checkIn);
  checkInRef.current = checkIn;
  const previousHabitIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void ensureHabitConfirmationCategory();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const activeHabits = habits.filter((habit) => !habit.archived);
    const activeIds = new Set(activeHabits.map((habit) => habit.id));

    void (async () => {
      // Cancel reminders for any habit that's gone (deleted or newly archived) since the last
      // run -- scheduleHabitReminder below only touches ids for habits still present.
      const removedIds = [...previousHabitIdsRef.current].filter((id) => !activeIds.has(id));
      await Promise.all(removedIds.map((id) => cancelAllHabitReminders(id)));
      await Promise.all(activeHabits.map((habit) => scheduleHabitReminder(habit)));
      previousHabitIdsRef.current = activeIds;
    })();
  }, [habits]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) return; // plain tap, no action chosen

      const habitId = response.notification.request.content.data?.habitId;
      if (typeof habitId !== 'string') return;

      const status: HabitCheckInValues['status'] = response.actionIdentifier === HABIT_CONFIRM_YES_ACTION ? 'DONE' : 'SKIPPED';
      void checkInRef.current(habitId, { date: todayKey(), value: status === 'DONE' ? 1 : 0, status });
    });

    return () => subscription.remove();
  }, []);
}
