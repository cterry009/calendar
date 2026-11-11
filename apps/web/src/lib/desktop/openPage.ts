import { isDesktop } from './index';

// 2026-11-09: the radars and the reading log live as Claude artifacts whose data is in their own
// artifact database, so they only work on claude.ai. On the desktop they open in an app window
// (signed in to claude.ai once, the session is kept); in a browser, in a new tab.
export async function openExternalPage(url: string, title?: string): Promise<void> {
  void title; // kept for callers; the browser names the tab itself
  if (isDesktop) {
    // 2026-11-11: an app window has no claude.ai session ("Inicia sesión"); the default browser does.
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_url', { url });
      return;
    } catch {
      // fall through
    }
  }
  window.open(url, '_blank', 'noopener');
}
