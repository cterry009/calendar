export interface StepTrackingNativeModule {
  startTracking(): void;
  stopTracking(): void;
  setDailyGoal(goal: number): void;
  getDailyGoal(): number;
  getDailySteps(): number;
  isStepSensorAvailable(): boolean;
}
