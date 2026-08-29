import { PermissionsAndroid, Platform } from 'react-native';
import ActivityRecognitionModule from '../../../modules/activity-recognition/src';

// The activityType string an auto-logged jog FitnessEntry uses, and the value the "Deporte" habit
// template's linkedFitnessActivityType is seeded with (task 11.7) -- kept as one shared constant
// so the two can't drift apart, breaking the case-insensitive match sync.service.ts does between
// them.
export const JOG_ACTIVITY_TYPE = 'Trote';

// ACTIVITY_RECOGNITION only became a runtime permission on Android 10 (API 29); below that it's a
// normal permission, always granted as long as declared in the manifest. This is the same
// permission expo-sensors' Pedometer.requestPermissionsAsync() already requests for step
// counting (see useDailySteps.ts) -- a user who already granted steps access won't see a second
// system dialog here.
export async function hasActivityRecognitionPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (Number(Platform.Version) < 29) return true;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION);
}

export async function requestActivityRecognitionPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (Number(Platform.Version) < 29) return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export function startJogDetection(): void {
  if (Platform.OS !== 'android') return;
  ActivityRecognitionModule.startTracking();
}

export function stopJogDetection(): void {
  if (Platform.OS !== 'android') return;
  ActivityRecognitionModule.stopTracking();
}

// Native-side, date-scoped flag written by ActivityTransitionReceiver.kt -- survives the RN JS
// process having been dead all night, which is the whole point (see task 11.2's design notes).
export function hasJoggedToday(): boolean {
  if (Platform.OS !== 'android') return false;
  return ActivityRecognitionModule.hasJoggedToday();
}

// Real measured ENTER-to-EXIT duration from the native side, not a guess -- null until a run has
// actually finished (still running, or no run yet today). See autoLog.ts, the only caller.
export function getLastJogDurationMinutes(): number | null {
  if (Platform.OS !== 'android') return null;
  return ActivityRecognitionModule.getLastJogDurationMinutes();
}
