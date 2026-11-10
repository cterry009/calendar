import { isDesktop } from './index';
import { openExternalPage } from './openPage';

// 2026-11-10: open a project's folder in VS Code or one of its files/links. On the desktop app through
// Rust commands (launch.rs); in a browser a folder opens through VS Code's vscode:// link and a local
// file can't be opened (the path is copied instead).

const isUrl = (p: string) => /^https?:\/\//i.test(p);

export async function openInVsCode(path: string): Promise<string | null> {
  if (isDesktop) {
    const { invoke } = await import('@tauri-apps/api/core');
    try {
      await invoke('open_in_vscode', { path });
      return null;
    } catch (e) {
      return String(e);
    }
  }
  window.location.href = `vscode://file/${path.replace(/\\/g, '/')}`;
  return null;
}

export async function openLink(path: string, label: string): Promise<string | null> {
  if (isUrl(path)) {
    await openExternalPage(path, label);
    return null;
  }
  if (isDesktop) {
    const { invoke } = await import('@tauri-apps/api/core');
    try {
      await invoke('open_path', { path });
      return null;
    } catch (e) {
      return String(e);
    }
  }
  try {
    await navigator.clipboard.writeText(path);
    return 'En el navegador no se abren archivos locales: copié la ruta.';
  } catch {
    return `Ruta: ${path}`;
  }
}
