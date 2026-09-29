import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getWorkGameLimit,
  isGameLockReached,
  markFinalWarningGiven,
  startCloseCountdown,
  subscribeWorkGameLimit,
} from './workGameLimit';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => Array.from(data.keys())[index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

describe('workGameLimit', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 25, 10, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts empty each day', () => {
    expect(getWorkGameLimit('GAMES')).toEqual({ finalWarningGiven: false, closeDeadline: null });
  });

  it('gives 5 minutes of grace from the closing warning', () => {
    const start = Date.now();
    const deadline = startCloseCountdown('GAMES', start);
    expect(deadline - start).toBe(5 * 60_000);
    expect(isGameLockReached(getWorkGameLimit('GAMES'), start + 4 * 60_000)).toBe(false);
    expect(isGameLockReached(getWorkGameLimit('GAMES'), deadline)).toBe(true);
  });

  it('never restarts a running countdown', () => {
    const first = startCloseCountdown('GAMES', Date.now());
    const second = startCloseCountdown('GAMES', Date.now() + 60_000);
    expect(second).toBe(first);
  });

  it('keeps the final-warning flag when the countdown starts', () => {
    markFinalWarningGiven('GAMES');
    startCloseCountdown('GAMES', Date.now());
    expect(getWorkGameLimit('GAMES').finalWarningGiven).toBe(true);
  });

  it('resets the next day', () => {
    markFinalWarningGiven('GAMES');
    startCloseCountdown('GAMES', Date.now());
    vi.setSystemTime(new Date(2026, 8, 26, 9, 0, 0));
    expect(getWorkGameLimit('GAMES')).toEqual({ finalWarningGiven: false, closeDeadline: null });
  });

  it('keeps games and social media on separate clocks', () => {
    startCloseCountdown('SOCIAL', Date.now());
    expect(getWorkGameLimit('SOCIAL').closeDeadline).not.toBeNull();
    expect(getWorkGameLimit('GAMES')).toEqual({ finalWarningGiven: false, closeDeadline: null });
  });

  it('notifies subscribers on every change', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeWorkGameLimit(listener);
    markFinalWarningGiven('GAMES');
    startCloseCountdown('GAMES', Date.now());
    unsubscribe();
    markFinalWarningGiven('GAMES');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
