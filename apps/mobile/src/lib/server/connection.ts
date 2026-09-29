import { env } from '../auth/env';
import { platformStorage } from '../platformStorage';

// Which server the app talks to, whether it's reachable right now, and a fetch that gives up
// instead of hanging.
//
// **Why the timeout matters.** React Native's Android networking (OkHttp) is configured with no
// connect/read timeout. When the server's host is simply not there -- PC off, phone on another
// network, the PC's LAN IP reassigned by DHCP -- a request doesn't fail, it waits indefinitely.
// Before this module the app's boot awaited one such request, so the loading screen never went
// away: the "frozen app". Every request now goes through fetchWithTimeout, which turns that
// silence into an error the UI can show.
//
// **Why the URL is editable.** EXPO_PUBLIC_API_URL is inlined at build time, so a DHCP change used
// to mean a rebuild. A user override, stored on the device, now takes precedence over it.

const SERVER_URL_KEY = 'calendar_server_url_v1';

export const REQUEST_TIMEOUT_MS = 15_000;
const HEALTH_TIMEOUT_MS = 5_000;

export class ServerUnreachableError extends Error {
  constructor(readonly url: string, reason: 'timeout' | 'network') {
    super(
      reason === 'timeout'
        ? `El servidor no respondió a tiempo (${displayHost(url)}).`
        : `No se pudo conectar con el servidor (${displayHost(url)}).`,
    );
    this.name = 'ServerUnreachableError';
  }
}

export function displayHost(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

/** Accepts "192.168.1.5:3000" or a full URL; returns a normalized URL or null. */
export function normalizeServerUrl(input: string): string | null {
  const trimmed = input.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (!parsed.hostname) return null;
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

// ---- Server URL ----

let override: string | null = null;
let overrideLoaded: Promise<void> | null = null;

export function getApiUrl(): string {
  return override ?? env.apiUrl;
}

export function getDefaultApiUrl(): string {
  return env.apiUrl;
}

export function loadServerUrl(): Promise<void> {
  if (!overrideLoaded) {
    overrideLoaded = (async () => {
      try {
        const stored = await platformStorage.getItem(SERVER_URL_KEY);
        override = stored ? normalizeServerUrl(stored) : null;
      } catch {
        override = null;
      }
    })();
  }
  return overrideLoaded;
}

/** null restores the build-time default. */
export async function setServerUrl(url: string | null): Promise<void> {
  override = url;
  if (url) await platformStorage.setItem(SERVER_URL_KEY, url);
  else await platformStorage.removeItem(SERVER_URL_KEY);
  setConnection({ state: 'checking', url: getApiUrl(), error: null });
  void checkServer();
}

// ---- Connection status ----

export type ConnectionState = 'checking' | 'online' | 'offline';

export interface ConnectionStatus {
  state: ConnectionState;
  url: string;
  /** Human-readable reason for the last failure, when offline. */
  error: string | null;
  lastCheckedAt: number | null;
}

let connection: ConnectionStatus = { state: 'checking', url: env.apiUrl, error: null, lastCheckedAt: null };
const listeners = new Set<(status: ConnectionStatus) => void>();

function setConnection(patch: Partial<ConnectionStatus>) {
  connection = { ...connection, ...patch };
  listeners.forEach((listener) => listener(connection));
}

export function subscribeConnection(listener: (status: ConnectionStatus) => void): () => void {
  listeners.add(listener);
  listener(connection);
  return () => {
    listeners.delete(listener);
  };
}

export function getConnection(): ConnectionStatus {
  return connection;
}

function markOnline(url: string) {
  setConnection({ state: 'online', url, error: null, lastCheckedAt: Date.now() });
}

function markOffline(url: string, error: string) {
  setConnection({ state: 'offline', url, error, lastCheckedAt: Date.now() });
}

/**
 * fetch with a deadline. Any HTTP response -- even a 4xx/5xx -- proves the server is reachable, so
 * it marks the connection online; only a network failure or the deadline marks it offline.
 */
export async function fetchWithTimeout(
  path: string,
  init: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
  baseUrl = getApiUrl(),
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, { ...init, signal: controller.signal });
    if (baseUrl === getApiUrl()) markOnline(baseUrl);
    return response;
  } catch {
    const error = new ServerUnreachableError(baseUrl, controller.signal.aborted ? 'timeout' : 'network');
    if (baseUrl === getApiUrl()) markOffline(baseUrl, error.message);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

let inFlight: Promise<boolean> | null = null;

/** Pings the server; resolves true when it answered at all. Concurrent calls share one ping. */
export function checkServer(baseUrl = getApiUrl()): Promise<boolean> {
  if (baseUrl !== getApiUrl()) return probe(baseUrl);
  if (!inFlight) {
    if (connection.state !== 'online') setConnection({ state: 'checking', url: baseUrl });
    inFlight = probe(baseUrl).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function probe(baseUrl: string): Promise<boolean> {
  try {
    // The root path 404s on this API, which is fine: any answer means the server is up.
    await fetchWithTimeout('/', { method: 'GET' }, HEALTH_TIMEOUT_MS, baseUrl);
    return true;
  } catch {
    return false;
  }
}
