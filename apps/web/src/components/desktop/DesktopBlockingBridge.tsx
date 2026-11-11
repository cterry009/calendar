import { useEffect, useMemo } from 'react';
import { isInNightWindow } from '@calendar/shared';
import { useBlockList } from '../../hooks/useBlockList';
import { useCommitment } from '../../hooks/useCommitment';
import { useNightClock, useNightSettings } from '../../hooks/useNightWindowActive';
import { useWorkGameLock } from '../../hooks/useWorkGameLock';
import { ALL_GAMES_IDENTIFIER, focusBlockTargets } from '../../lib/desktop/focusBlockTargets';
import { updateGameBreakContext, useGameBreak } from '../../lib/checkins/gameBreakStore';
import { usePomodoro } from '../../context/PomodoroContext';
import { useSoftFocus } from '../../context/SoftFocusContext';
import { isDesktop } from '../../lib/desktop';

// Tasks 9.3 + 9.4. Pushes the desktop blocking policy to Rust, which enforces it:
//   - DESKTOP_APP entries -> apps/desktop/src-tauri/src/blocking.rs terminates matching processes
//     (including `steam:<appid>` identifiers, resolved to the game's real install folder there).
//   - WEBSITE entries     -> apps/desktop/src-tauri/src/hosts.rs points the domains at 0.0.0.0 in
//                            the system hosts file.
// Same "JS owns the policy, native enforces" split as the tray (9.2) and every Android module.
//
// Each entry's own `scope` decides *when* it's active, unioned into whatever's currently blocked:
// FOCUS entries follow the existing SoftFocus signal (`isOverlayVisible` = pomodoro focus ||
// manual soft-focus || work-hours || location), NIGHT entries follow the user-configured night window
// (lib/desktop/nightWindow.ts, on/off + HH:MM), each from its own start when it has one, and Friday
// and Saturday from the weekend start (weekend-mode). Rust itself has no notion of scope --
// it just kills/blocks whatever's in the list it's handed while `active`, so this component is
// the only place the FOCUS/NIGHT distinction is computed. Renders nothing; completely inert in a
// plain browser.

// One entry can name several processes, "a.exe|b.exe": League of Legends is a client and a game.
function identifiersFor(
  entries: ReturnType<typeof useBlockList>['entries'],
  kind: 'DESKTOP_APP' | 'WEBSITE',
  scope: 'FOCUS' | 'NIGHT',
): string[] {
  return entries
    .filter(
      (entry) =>
        entry.enabled &&
        entry.kind === kind &&
        (entry.scope ?? 'FOCUS') === scope &&
        (kind === 'WEBSITE' || entry.platform === 'WINDOWS' || entry.platform == null),
    )
    .flatMap((entry) => (kind === 'DESKTOP_APP' ? entry.identifier.split('|') : [entry.identifier]))
    .map((identifier) => identifier.trim())
    .filter(Boolean);
}

export function DesktopBlockingBridge() {
  const { isFocusActive: isOverlayVisible, isWithinWorkSchedule, isInWorkWindow, manualSoftFocus, isLocationActive } = useSoftFocus();
  const pomodoro = usePomodoro();
  const gameBreak = useGameBreak();
  const { enabled: nightEnabled, window: nightWindow } = useNightSettings();
  const { isLocked } = useCommitment();
  const now = useNightClock();
  // The commitment keeps the night block on, whatever the local switch says.
  const nightOn = nightEnabled || isLocked;
  const isNightActive = nightOn && isInNightWindow(now, nightWindow);
  const { entries } = useBlockList('ALL');
  // Which NIGHT entries have started, as a string so the memos below don't rerun on every tick.
  const startedNightIds = nightOn
    ? entries
        .filter((entry) => entry.scope === 'NIGHT' && isInNightWindow(now, nightWindow, entry))
        .map((entry) => entry.id)
        .join(' ')
    : '';
  const nightEntries = useMemo(() => {
    const started = new Set(startedNightIds.split(' '));
    return entries.filter((entry) => started.has(entry.id));
  }, [entries, startedNightIds]);
  // Games locked by the strict work-hours limit (DesktopUsageWarnings starts the countdown; this
  // enforces it). Not block-list entries -- a temporary union that disappears when the WORK block
  // ends.
  const workLockedGames = useWorkGameLock(isWithinWorkSchedule);
  // In a work focus (pomodoro, manual focus, or a WORK block -- the latter even if its soft overlay
  // was dismissed), every game and the social apps/sites are blocked outright, list or no list. So
  // through a weekday work window, even between flexible blocks (user, 2026-10-29); the rest of the
  // FOCUS list still waits for a started focus.
  const inWorkFocus = isOverlayVisible || isWithinWorkSchedule || isInWorkWindow;
  // The night window (on/off + hours in the Nocturno tab) blocks the same targets: from 22:30 by
  // default, social media and games are off until morning, list or no list.
  // 2026-11-10: work-hours game breaks -- in the work window (or between pomodoros of a WORK block),
  // with no focus phase, no manual/location focus and not at night, games may run while today's
  // budget and the 20-minute break last (gameBreakStore counts the minutes). Social stays blocked.
  const hardFocus = pomodoro.isBlocking || manualSoftFocus.active || isLocationActive;
  useEffect(() => {
    updateGameBreakContext({ inWorkWindow: isInWorkWindow || isWithinWorkSchedule, inFocus: hardFocus });
  }, [isInWorkWindow, isWithinWorkSchedule, hardFocus]);
  const gamesOnBreak = inWorkFocus && !hardFocus && !isNightActive && gameBreak.allowed;
  const focusTargets = useMemo(() => {
    const targets = focusBlockTargets(inWorkFocus || isNightActive);
    return gamesOnBreak ? { ...targets, processes: targets.processes.filter((p) => p !== ALL_GAMES_IDENTIFIER) } : targets;
  }, [inWorkFocus, isNightActive, gamesOnBreak]);

  // On a game break the user's own FOCUS list (which lists League of Legends) waits for a focus phase too.
  const focusListActive = gamesOnBreak ? hardFocus : isOverlayVisible;
  const blockedProcesses = useMemo(() => {
    const focus = focusListActive ? identifiersFor(entries, 'DESKTOP_APP', 'FOCUS') : [];
    const night = identifiersFor(nightEntries, 'DESKTOP_APP', 'NIGHT');
    return Array.from(new Set([...focus, ...night, ...workLockedGames, ...focusTargets.processes]));
  }, [entries, nightEntries, focusListActive, workLockedGames, focusTargets]);

  const blockedWebsites = useMemo(() => {
    const focus = isOverlayVisible ? identifiersFor(entries, 'WEBSITE', 'FOCUS') : [];
    const night = identifiersFor(nightEntries, 'WEBSITE', 'NIGHT');
    return Array.from(new Set([...focus, ...night, ...focusTargets.websites]));
  }, [entries, nightEntries, isOverlayVisible, focusTargets]);

  // Rust's `active` flag is a single on/off gate for the whole list it's handed -- since the list
  // passed below is already the FOCUS/NIGHT union for whichever window(s) are currently open,
  // "active" here just means "is there anything to enforce right now."
  const processesActive = blockedProcesses.length > 0;
  const websitesActive = blockedWebsites.length > 0;

  // join()s stand in for array identity so the effects re-run on content change.
  const blockedKey = blockedProcesses.join(' ');
  const websiteKey = blockedWebsites.join(' ');

  useEffect(() => {
    if (!isDesktop) return;
    void import('@tauri-apps/api/core')
      .then(({ invoke }) =>
        invoke('set_process_blocking', { active: processesActive, blocked: blockedProcesses }),
      )
      .catch(() => {
        // Native side not ready / not desktop.
      });
  }, [processesActive, blockedKey, blockedProcesses]);

  useEffect(() => {
    if (!isDesktop) return;
    void import('@tauri-apps/api/core')
      .then(({ invoke }) =>
        invoke<{ changed: boolean; needs_permission: boolean }>('set_website_blocking', {
          active: websitesActive,
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
  }, [websitesActive, websiteKey, blockedWebsites]);

  // The `process-blocked` event -> the visible card lives in DesktopBlockedOverlay (task 9.6).

  return null;
}
