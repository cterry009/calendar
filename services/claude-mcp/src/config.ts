import { homedir } from 'node:os';
import { join } from 'node:path';

export const API_URL = (process.env.CALENDAR_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
export const TIME_ZONE = process.env.CALENDAR_TZ ?? 'America/Bogota';

/** %APPDATA%\calendar-claude-mcp\token.json on Windows, ~/.config/calendar-claude-mcp elsewhere. */
export function tokenPath(): string {
  const base = process.env.APPDATA ?? join(homedir(), '.config');
  return join(base, 'calendar-claude-mcp', 'token.json');
}
