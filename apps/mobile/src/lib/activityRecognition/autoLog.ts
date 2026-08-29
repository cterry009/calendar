import type { FitnessSyncChangeDto } from '../fitness/api';
import { syncFitnessBatch } from '../fitness/api';
import { platformStorage } from '../platformStorage';
import { JOG_ACTIVITY_TYPE, getLastJogDurationMinutes, hasJoggedToday } from './api';

// Mirrors suggestionNotifications.ts's per-day dedupe pattern. hasJoggedToday() is already
// date-scoped natively, but that only tells us Play Services confirmed a run *today* -- it says
// nothing about whether this JS session already logged it, so a separate local key still avoids
// creating a duplicate FitnessEntry every time this runs (e.g. on every app foreground).
const LAST_LOGGED_KEY = 'calendar.activityRecognition.lastAutoLoggedJogDate';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// Turns a native-confirmed, native-measured jog into a FitnessEntry so it flows through the
// existing linkedFitnessActivityType -> HabitRecord auto-complete path (server's sync.service.ts)
// unmodified -- no separate "mark habit done" call needed. Deliberately waits for a real measured
// duration (getLastJogDurationMinutes(), set once Play Services reports the RUNNING EXIT) rather
// than logging a guessed duration the moment the jog starts -- safe to call opportunistically
// (app foreground, mount) since it's a no-op until that duration is available, and again once
// already logged for today. Known simplification: a second jog later the same day silently
// doesn't get a second entry -- the "one auto-log per day" this dedupe key enforces matches the
// habit's own one-record-per-day model.
export async function maybeAutoLogJog(): Promise<void> {
  if (!hasJoggedToday()) return;

  const durationMinutes = getLastJogDurationMinutes();
  if (durationMinutes == null) return;

  const today = todayKey();
  const lastLogged = await platformStorage.getItem(LAST_LOGGED_KEY);
  if (lastLogged === today) return;

  const payload: FitnessSyncChangeDto = {
    updatedAt: new Date().toISOString(),
    activityType: JOG_ACTIVITY_TYPE,
    durationMinutes,
    intensity: 'MEDIUM',
    loggedAt: new Date().toISOString(),
    source: 'DEVICE_SENSOR',
  };

  await syncFitnessBatch([payload]);
  await platformStorage.setItem(LAST_LOGGED_KEY, today);
}
