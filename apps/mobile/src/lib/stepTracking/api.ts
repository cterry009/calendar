import { Platform } from 'react-native';
import StepTrackingModule from '../../../modules/step-tracking/src';

// Task 11.16 (user follow-up after real-device testing found Health Connect doesn't work on the
// test hardware): a native foreground service reading TYPE_STEP_COUNTER directly, independent of
// both the RN JS process and Health Connect. Its persistent notification (with a progress bar
// toward the daily goal below) is the visible "this is running in the background" signal the
// user asked for -- Android requires a foreground service to show one, so it's not extra work,
// it's the same requirement that makes background tracking possible at all.
export function startStepTracking(): void {
  if (Platform.OS !== 'android') return;
  StepTrackingModule.startTracking();
}

export function stopStepTracking(): void {
  if (Platform.OS !== 'android') return;
  StepTrackingModule.stopTracking();
}

export function setDailyStepGoal(goal: number): void {
  if (Platform.OS !== 'android') return;
  StepTrackingModule.setDailyGoal(Math.max(1, Math.round(goal)));
}

export function getDailyStepGoal(): number {
  if (Platform.OS !== 'android') return 8000;
  return StepTrackingModule.getDailyGoal();
}

// Native-side, date-scoped total from the always-on foreground-service sensor listener --
// survives the RN JS process having been dead, same as the other native-prefs reads in this app
// (hasJoggedToday, isNightEnabled).
export function getNativeDailySteps(): number {
  if (Platform.OS !== 'android') return 0;
  return StepTrackingModule.getDailySteps();
}

export function isStepSensorAvailable(): boolean {
  if (Platform.OS !== 'android') return false;
  return StepTrackingModule.isStepSensorAvailable();
}
