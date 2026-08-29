export interface ActivityRecognitionNativeModule {
  hasPermission(): boolean;
  startTracking(): void;
  stopTracking(): void;
  hasJoggedToday(): boolean;
  getLastJogDurationMinutes(): number | null;
}
