// Metro platform-split (same pattern as platformStorage.web.ts / installedApps.web.ts): keep
// expo-audio out of the web-preview bundle entirely -- apps/mobile only ships Android, and the
// web preview target has no need for the phase-complete sound.
export function playPomodoroChime(): void {}
