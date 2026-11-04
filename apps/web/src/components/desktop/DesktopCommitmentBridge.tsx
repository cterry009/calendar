import { useEffect } from 'react';
import { isCommitmentActive } from '@calendar/shared';
import { useCommitment } from '../../hooks/useCommitment';
import { useNightClock } from '../../hooks/useNightWindowActive';
import { isDesktop } from '../../lib/desktop';

// The block commitment on the PC (weekend-mode): while it lasts the tray can't quit, the app starts
// with Windows and a scheduled task relaunches it if it's killed (src-tauri/src/commitment.rs).
// Rust only does what it's told, so when the commitment ends this undoes it. Renders nothing.
export function DesktopCommitmentBridge() {
  const { commitment } = useCommitment();
  const now = useNightClock();
  const active = isCommitmentActive(commitment, now);

  useEffect(() => {
    if (!isDesktop) return;
    void import('@tauri-apps/api/core')
      .then(({ invoke }) => invoke('set_commitment', { active }))
      .catch(() => {
        // Native side not ready / an older build.
      });
    if (active) {
      void import('@tauri-apps/plugin-autostart').then(({ enable }) => enable()).catch(() => undefined);
    }
  }, [active]);

  return null;
}
