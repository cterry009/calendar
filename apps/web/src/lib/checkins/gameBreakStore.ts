import { useEffect, useState } from 'react';
import { gameBreakAllowed, gameBreakBudget, localDateKey } from '@calendar/shared';
import { isDesktop } from '../desktop';
import type { DesktopGameTimeEntry } from '../gameTime/sync';

// 2026-11-10: work-hours game breaks. Once a minute it reads today's game total from the desktop
// tracker (local, no server) and, while the work window is open and no focus runs, counts the new
// minutes against today's budget and the current break. Kept per device and day in localStorage.

interface Stored {
  day: string;
  usedToday: number;
  currentSession: number;
  lastTotal: number | null;
  lastGameAt: number | null;
  /** [epoch ms, minutes] game minutes counted in work time, for the dynamic check-in (last 30 min). */
  recent: Array<[number, number]>;
}

const KEY = 'calendar.gameBreaks';
const listeners = new Set<() => void>();
let started = false;
let inWorkWindow = false;
let inFocus = false;

function read(): Stored {
  const day = localDateKey(new Date());
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as Stored | null;
    if (v && v.day === day) return v;
  } catch {
    /* fresh */
  }
  return { day, usedToday: 0, currentSession: 0, lastTotal: null, lastGameAt: null, recent: [] };
}

function write(s: Stored) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* per device */
  }
  listeners.forEach((l) => l());
}

async function tick() {
  const { invoke } = await import('@tauri-apps/api/core');
  const entries = await invoke<DesktopGameTimeEntry[]>('get_game_time_today').catch(() => [] as DesktopGameTimeEntry[]);
  const total = entries.reduce((a, e) => a + e.minutes, 0);
  const s = read();
  const now = Date.now();
  const delta = s.lastTotal === null ? 0 : Math.max(0, total - s.lastTotal);
  s.lastTotal = total;
  if (delta > 0) {
    s.lastGameAt = now;
    if (inWorkWindow && !inFocus) {
      s.usedToday += delta;
      s.currentSession += delta;
      s.recent.push([now, delta]);
    }
  } else if (s.lastGameAt !== null && now - s.lastGameAt > 5 * 60_000) {
    s.currentSession = 0; // a break ends after 5 minutes without playing
  }
  s.recent = s.recent.filter(([t]) => now - t <= 30 * 60_000);
  write(s);
}

/** Called by the blocking bridge with the current window/focus state; starts the minute tick once. */
export function updateGameBreakContext(next: { inWorkWindow: boolean; inFocus: boolean }) {
  inWorkWindow = next.inWorkWindow;
  inFocus = next.inFocus;
  if (started || !isDesktop) return;
  started = true;
  void tick();
  window.setInterval(() => void tick(), 60_000);
}

export interface GameBreakView {
  budget: number;
  usedToday: number;
  currentSession: number;
  allowed: boolean;
  recentWorkGameMinutes: number;
}

export function useGameBreak(): GameBreakView {
  const [s, setS] = useState(read);
  useEffect(() => {
    const l = () => setS(read());
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const day = localDateKey(new Date());
  return {
    budget: gameBreakBudget(day),
    usedToday: s.usedToday,
    currentSession: s.currentSession,
    allowed: gameBreakAllowed(day, { usedToday: s.usedToday, currentSession: s.currentSession }),
    recentWorkGameMinutes: s.recent.reduce((a, [, m]) => a + m, 0),
  };
}
