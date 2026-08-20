import { platformStorage } from '../platformStorage';
import type { AuthSession, AuthUser } from './types';

// platformStorage is AsyncStorage on native, plain localStorage on web (see
// platformStorage.web.ts for why: AsyncStorage's own web shim crashes at import time under
// Metro in this setup). Same single-JSON-blob shape apps/web uses under
// 'calendar.auth.session', just async since AsyncStorage (unlike localStorage) has no
// synchronous API. Migrating to expo-secure-store for real native builds is a reasonable
// follow-up hardening step, not done here -- it also has no web implementation.
const SESSION_KEY = 'calendar.auth.session';

export async function loadSession(): Promise<AuthSession | null> {
  try {
    const raw = await platformStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export async function saveSession(session: AuthSession): Promise<void> {
  await platformStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await platformStorage.removeItem(SESSION_KEY);
}

export async function getAccessToken(): Promise<string | null> {
  return (await loadSession())?.accessToken ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  return (await loadSession())?.refreshToken ?? null;
}

export async function getStoredUser(): Promise<AuthUser | null> {
  return (await loadSession())?.user ?? null;
}

export async function updateSessionTokens(
  accessToken: string,
  refreshToken: string,
  expiresIn: string,
): Promise<AuthSession | null> {
  const current = await loadSession();
  if (!current) return null;
  const next = { ...current, accessToken, refreshToken, expiresIn };
  await saveSession(next);
  return next;
}
