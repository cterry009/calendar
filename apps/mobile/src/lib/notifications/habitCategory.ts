import * as Notifications from 'expo-notifications';

// Task 11.6: first use of expo-notifications' category/action-button API in this codebase (the
// two existing local-notification paths, pomodoro phase-complete and suggestions, are plain
// tap-to-open). Registered once per app session from useHabitReminders.ts.
export const HABIT_CONFIRMATION_CATEGORY = 'habit-confirmation';
export const HABIT_CONFIRM_YES_ACTION = 'yes';
export const HABIT_CONFIRM_NO_ACTION = 'no';

let registered = false;

export async function ensureHabitConfirmationCategory(): Promise<void> {
  if (registered) return;

  try {
    await Notifications.setNotificationCategoryAsync(HABIT_CONFIRMATION_CATEGORY, [
      { identifier: HABIT_CONFIRM_YES_ACTION, buttonTitle: 'Si' },
      { identifier: HABIT_CONFIRM_NO_ACTION, buttonTitle: 'No' },
    ]);
    registered = true;
  } catch {
    // Same "no real scheduler/category backing on web" gap lib/notifications/api.ts's
    // sendLocalNotification already tolerates -- not registered, left false so a later call on a
    // real platform still retries instead of being permanently skipped by this session's cache.
  }
}
