import { isDesktop } from './index';

// 2026-11-09: the radars and the reading log live as Claude artifacts whose data is in their own
// artifact database, so they only work on claude.ai. On the desktop they open in an app window
// (signed in to claude.ai once, the session is kept); in a browser, in a new tab.
export async function openExternalPage(url: string, title: string): Promise<void> {
  if (isDesktop) {
    try {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const label = `page-${url.replace(/[^a-zA-Z0-9]/g, '').slice(-24)}`;
      const existing = await WebviewWindow.getByLabel(label);
      if (existing) {
        await existing.setFocus();
        return;
      }
      new WebviewWindow(label, { url, title, width: 1200, height: 860, center: true });
      return;
    } catch {
      // fall through to a plain tab
    }
  }
  window.open(url, '_blank', 'noopener');
}
