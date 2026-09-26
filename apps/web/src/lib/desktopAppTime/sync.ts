// Builds the daily rollup pushed via useSync().batchSync({ dailyDesktopAppTime: [...] }) from the
// Tauri `get_app_time_today` command's result -- the generic-app counterpart of
// lib/gameTime/sync.ts's buildDailyGameTimeUpsert.

export interface DesktopAppTimeEntry {
  key: string;
  label: string;
  minutes: number;
}

export interface DailyDesktopAppTimeUpsert {
  date: string;
  totalMinutes: number;
  topApps: DesktopAppTimeEntry[];
  updatedAt: string;
}

// Matches the server's @ArrayMaxSize(10) cap on topApps (see sync-batch.dto.ts's
// DailyDesktopAppTimeSyncChangeDto) -- a display snapshot, not a full per-app ledger.
const TOP_APPS_COUNT = 10;

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function buildDailyDesktopAppTimeUpsert(
  entries: DesktopAppTimeEntry[],
): DailyDesktopAppTimeUpsert {
  // Sub-minute entries are dropped rather than shown as "0 min": foreground tracking produces a
  // long tail of them from alt-tabbing through windows, and they'd otherwise take top-10 slots
  // away from apps actually used.
  //
  // `totalMinutes` covers every app that survived the filter, so it can exceed the listed rows'
  // sum when more than ten apps were used -- same as the game rollup. Unlike that one, though,
  // this total is meaningful on its own: only one app holds the foreground at a time, so the
  // per-app minutes never overlap and add up to real active time at the PC.
  const used = entries.filter((entry) => entry.minutes > 0);
  const sorted = [...used].sort((a, b) => b.minutes - a.minutes);
  const totalMinutes = sorted.reduce((sum, entry) => sum + entry.minutes, 0);

  return {
    date: startOfToday().toISOString(),
    totalMinutes,
    topApps: sorted.slice(0, TOP_APPS_COUNT),
    updatedAt: new Date().toISOString(),
  };
}
