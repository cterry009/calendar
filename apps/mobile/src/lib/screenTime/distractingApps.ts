// Moved to packages/shared/src/screenTime/socialPackages.ts so the "redes sociales" dashboard
// subtotal (shared by web and mobile, packages/shared/src/analytics/dashboard.ts) uses the exact
// same curated list as this app's own "Sugerencias de bloqueo" panel (tasks 7.20/7.21), instead
// of two independent lists that could silently drift. Re-exported here so existing imports in
// this app keep working unchanged.
export { isKnownDistractingApp } from '@calendar/shared';
