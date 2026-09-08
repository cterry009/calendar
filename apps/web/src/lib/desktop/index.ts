// True only when apps/web is running inside the Tauri desktop shell (apps/desktop), not a plain
// browser tab. `__TAURI_INTERNALS__` is the marker Tauri 2 injects into the webview global.
// Kept as a raw check so `@tauri-apps/api` is never imported on the web path -- desktop-only code
// dynamic-imports it behind this guard.
export const isDesktop =
  typeof window !== 'undefined' &&
  Object.prototype.hasOwnProperty.call(window, '__TAURI_INTERNALS__');
