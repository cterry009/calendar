import { env } from './env';
import { clearSession, getAccessToken, getRefreshToken, loadSession, saveSession, updateSessionTokens } from './storage';
import type { AuthSession, AuthUser, LoginInput, RegisterInput } from './types';
import { DEVICE_PLATFORM, getDeviceLabel } from './device';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(', ');
    if (body.message) return body.message;
  } catch {
    // Ignore JSON parsing failures for non-JSON responses.
  }

  return response.statusText || 'Request failed';
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  const response = await fetch(`${env.apiUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    await clearSession();
    return null;
  }

  const data = (await response.json()) as {
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
  };

  await updateSessionTokens(data.accessToken, data.refreshToken, data.expiresIn);
  return data.accessToken;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, retryOnUnauthorized = true): Promise<T> {
  const headers = new Headers(init.headers);

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const accessToken = await getAccessToken();
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const execute = () => fetch(`${env.apiUrl}${path}`, { ...init, headers });
  let response = await execute();

  if (response.status === 401 && retryOnUnauthorized && (await getRefreshToken())) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      headers.set('Authorization', `Bearer ${nextToken}`);
      response = await execute();
    }
  }

  if (!response.ok) {
    throw new ApiError(await parseError(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function persistSession(session: AuthSession): Promise<AuthSession> {
  await saveSession(session);
  return session;
}

export async function login(input: LoginInput): Promise<AuthSession> {
  const session = await apiFetch<AuthSession>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ ...input, deviceLabel: getDeviceLabel(), devicePlatform: DEVICE_PLATFORM }),
    },
    false,
  );

  return persistSession(session);
}

export async function register(input: RegisterInput): Promise<AuthSession> {
  const session = await apiFetch<AuthSession>(
    '/auth/register',
    {
      method: 'POST',
      body: JSON.stringify({ ...input, deviceLabel: getDeviceLabel(), devicePlatform: DEVICE_PLATFORM }),
    },
    false,
  );

  return persistSession(session);
}

export async function fetchProfile(): Promise<AuthUser> {
  return apiFetch<AuthUser>('/auth/me');
}

export async function logout(): Promise<void> {
  try {
    if (await loadSession()) {
      await apiFetch<void>('/auth/logout', { method: 'POST' });
    }
  } catch {
    // Ignore logout API failures and clear local state anyway.
  } finally {
    await clearSession();
  }
}
