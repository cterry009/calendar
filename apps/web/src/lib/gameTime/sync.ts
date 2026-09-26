// Windows desktop counterpart of apps/mobile/src/lib/screenTime/sync.ts's
// buildDailyScreenTimeUpsert -- builds the daily rollup pushed via useSync().batchSync({
// dailyGameTime: [...] }) from apps/desktop-tauri's `get_game_time_today` command result.

export interface DesktopGameTimeEntry {
  key: string;
  label: string;
  source: string;
  minutes: number;
}

export interface DailyGameTimeUpsert {
  date: string;
  totalMinutes: number;
  topGames: DesktopGameTimeEntry[];
  updatedAt: string;
}

// Matches the server's @ArrayMaxSize(10) cap on topGames (see
// server/src/sync/dto/sync-batch.dto.ts's DailyGameTimeSyncChangeDto) -- a display snapshot, not
// a full per-game ledger.
const TOP_GAMES_COUNT = 10;

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function buildDailyGameTimeUpsert(entries: DesktopGameTimeEntry[]): DailyGameTimeUpsert {
  const sorted = [...entries].sort((a, b) => b.minutes - a.minutes);
  const totalMinutes = sorted.reduce((sum, entry) => sum + entry.minutes, 0);

  return {
    date: startOfToday().toISOString(),
    totalMinutes,
    topGames: sorted.slice(0, TOP_GAMES_COUNT),
    updatedAt: new Date().toISOString(),
  };
}
