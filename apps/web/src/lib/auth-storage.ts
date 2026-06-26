import type { AuthSession, AuthUser } from './auth-types';

const SESSION_KEY = 'calendar.auth.session';

export function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function getAccessToken(): string | null {
  return loadSession()?.accessToken ?? null;
}

export function getRefreshToken(): string | null {
  return loadSession()?.refreshToken ?? null;
}

export function getStoredUser(): AuthUser | null {
  return loadSession()?.user ?? null;
}

export function updateSessionTokens(
  accessToken: string,
  refreshToken: string,
  expiresIn: string,
): AuthSession | null {
  const current = loadSession();
  if (!current) return null;
  const next = { ...current, accessToken, refreshToken, expiresIn };
  saveSession(next);
  return next;
}
