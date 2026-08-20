import type { Suggestion } from '@calendar/shared';
import { platformStorage } from '../platformStorage';
import { sendLocalNotification } from './api';

// No background/scheduled check -- this runs whenever useDashboard computes fresh metrics
// (i.e. whenever the dashboard screen is open), which needs no background-task infrastructure
// (expo-background-fetch/expo-task-manager) to get real, non-spammy value: at most one
// suggestion notification per day, deduped via the highest-priority suggestion's own kind so a
// changed suggestion on the same day still notifies once.
const LAST_NOTIFIED_KEY = 'calendar.suggestions.lastNotified';

function pickTopSuggestion(suggestions: Suggestion[]): Suggestion | null {
  const high = suggestions.find((suggestion) => suggestion.priority === 'high');
  return high ?? suggestions[0] ?? null;
}

export async function maybeNotifyTopSuggestion(suggestions: Suggestion[]): Promise<void> {
  const top = pickTopSuggestion(suggestions);
  if (!top) {
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const dedupeKey = `${today}:${top.kind}`;
  const lastNotified = await platformStorage.getItem(LAST_NOTIFIED_KEY);
  if (lastNotified === dedupeKey) {
    return;
  }

  await sendLocalNotification(top.title, top.message);
  await platformStorage.setItem(LAST_NOTIFIED_KEY, dedupeKey);
}
