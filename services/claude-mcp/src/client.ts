import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { API_URL, tokenPath } from './config.js';

// The bridge is its own device (platform AGENT, label "Claude"): it keeps a refresh token in the
// user's profile, refreshes the 15-minute access token itself and rotates the stored refresh token.
// Tokens are never logged.

interface Stored {
  refreshToken: string;
}

export class BridgeError extends Error {}

let accessToken: string | null = null;

function readStored(): Stored {
  try {
    const v = JSON.parse(readFileSync(tokenPath(), 'utf8')) as Stored;
    if (v.refreshToken) return v;
  } catch {
    /* handled below */
  }
  throw new BridgeError('El puente no tiene sesión. En el PC corre: npm run login --prefix services/claude-mcp');
}

export function storeRefreshToken(refreshToken: string): void {
  const p = tokenPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ refreshToken }), { encoding: 'utf8', mode: 0o600 });
}

async function raw(path: string, init: RequestInit = {}, token?: string): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new BridgeError(
      `La API del calendario no responde en ${API_URL}. En el PC corre scripts\\morning-start.ps1 (arranca Docker y la API).`,
    );
  }
}

async function refresh(): Promise<string> {
  const { refreshToken } = readStored();
  const res = await raw('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) });
  if (res.status === 401 || res.status === 403) {
    throw new BridgeError(
      'La sesión del puente fue revocada o venció. En el PC corre: npm run login --prefix services/claude-mcp',
    );
  }
  if (!res.ok) throw new BridgeError(`No se pudo renovar la sesión (${res.status}).`);
  const body = (await res.json()) as { accessToken: string; refreshToken: string };
  storeRefreshToken(body.refreshToken);
  accessToken = body.accessToken;
  return body.accessToken;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let token = accessToken ?? (await refresh());
  let res = await raw(path, init, token);
  if (res.status === 401) {
    token = await refresh();
    res = await raw(path, init, token);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new BridgeError(`La API respondió ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export async function login(email: string, password: string): Promise<void> {
  const res = await raw('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, deviceLabel: 'Claude', devicePlatform: 'AGENT' }),
  });
  if (!res.ok) throw new BridgeError(`No se pudo iniciar sesión (${res.status}). Revisa el correo y la contraseña.`);
  const body = (await res.json()) as { refreshToken: string };
  storeRefreshToken(body.refreshToken);
}
