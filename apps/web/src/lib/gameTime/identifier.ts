// Block-list identifier for a tracked game. blocking.rs resolves a `steam:<appid>` identifier to
// the game's real install folder and kills anything running from there; Riot/Battle.net games are
// already keyed by exe name (game_tracking.rs's KNOWN_GAME_PROCESSES table), which blocking.rs
// matches directly.
export function gameBlockIdentifier(game: { source: string; key: string }): string {
  return game.source === 'STEAM' ? `steam:${game.key}` : game.key;
}
