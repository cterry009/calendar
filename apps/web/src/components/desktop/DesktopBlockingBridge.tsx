import { useEffect, useMemo } from 'react';
import { useBlockList } from '../../hooks/useBlockList';
import { useSoftFocus } from '../../context/SoftFocusContext';
import { isDesktop } from '../../lib/desktop';

// Tasks 9.3 + 9.4. Pushes the desktop blocking policy to Rust, which enforces it:
//   - DESKTOP_APP entries -> apps/desktop/src-tauri/src/blocking.rs terminates matching processes.
//   - WEBSITE entries     -> apps/desktop/src-tauri/src/hosts.rs points the domains at 0.0.0.0 in
//                            the system hosts file.
// Same "JS owns the policy, native enforces" split as the tray (9.2) and every Android module.
//
// "Blocking is active" reuses the web's existing SoftFocus signal (`isOverlayVisible` = pomodoro
// focus || manual soft-focus || work-hours || location), so the desktop app enforces in exactly
// the situations the browser already shows its full-screen overlay. Renders nothing; completely
// inert in a plain browser.

export function DesktopBlockingBridge() {
  const { isOverlayVisible } = useSoftFocus();
  const { entries } = useBlockList();

  const blockedProcesses = useMemo(
    () =>
      entries
        .filter(
          (entry) =>
            entry.enabled &&
            entry.kind === 'DESKTOP_APP' &&
            (entry.platform === 'WINDOWS' || entry.platform == null),
        )
        .map((entry) => entry.identifier.trim())
        .filter(Boolean),
    [entries],
  );

  const blockedWebsites = useMemo(
    () =>
      entries
        .filter((entry) => entry.enabled && entry.kind === 'WEBSITE')
        .map((entry) => entry.identifier.trim())
        .filter(Boolean),
    [entries],
  );

  // join()s stand in for array identity so the effects re-run on content change.
  const blockedKey = blockedProcesses.join(' ');
  const websiteKey = blockedWebsites.join(' ');

  useEffect(() => {
    if (!isDesktop) return;
    void import('@tauri-apps/api/core')
      .then(({ invoke }) =>
        invoke('set_process_blocking', { active: isOverlayVisible, blocked: blockedProcesses }),
      )
      .catch(() => {
        // Native side not ready / not desktop.
      });
  }, [isOverlayVisible, blockedKey, blockedProcesses]);

  useEffect(() => {
    if (!isDesktop) return;
    void import('@tauri-apps/api/core')
      .then(({ invoke }) =>
        invoke<{ changed: boolean; needs_permission: boolean }>('set_website_blocking', {
          active: isOverlayVisible,
          domains: blockedWebsites,
        }),
      )
      .then((result) => {
        if (result?.needs_permission) {
          // Task 9.5 adds a proper "conceder acceso" button (-> invoke('request_hosts_access')).
          console.warn('[desktop] website blocking needs the one-time hosts-file permission grant');
          window.dispatchEvent(new CustomEvent('desktop:hosts-permission-needed'));
        }
      })
      .catch(() => {
        // Native side not ready / not desktop.
      });
  }, [isOverlayVisible, websiteKey, blockedWebsites]);

  // The `process-blocked` event -> the visible card lives in DesktopBlockedOverlay (task 9.6).

  return null;
}
