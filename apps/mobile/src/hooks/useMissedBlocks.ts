import { ATTENTION_PROFILE_SPECS } from '@calendar/shared';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { usePomodoro } from '../context/PomodoroContext';
import { blockToday } from '../lib/blockPrompt/block';
import { MISSED_LOOKBACK_DAYS, missedBlocks, type MissedBlock } from '../lib/blockPrompt/missed';
import { hhmm } from '../lib/blockPrompt/notifications';
import { DAY_ABBREVIATIONS_ES, isSameDay } from '../lib/calendar/utils';
import type { SyncScheduleRecord, SyncTaskRecord } from '../lib/calendar/types';
import { platformStorage } from '../lib/platformStorage';
import { pullSnapshot } from '../lib/sync/api';

// When the app opens (or comes back to the front) it lists the WORK blocks that weren't started
// since it last looked, each one reported once. A block still running can be started from there.
// Mounted once at the root, inside PomodoroProvider.

const CHECKED_AT_KEY = 'calendar:missed-blocks-checked-at';
/** A block still running is asked about again, but not on every trip back to the app. */
const RUNNING_REPEAT_MS = 20 * 60_000;

async function loadCheckedAt(now: Date): Promise<Date> {
  const floor = new Date(now.getFullYear(), now.getMonth(), now.getDate() - MISSED_LOOKBACK_DAYS);
  try {
    const raw = await platformStorage.getItem(CHECKED_AT_KEY);
    const saved = raw ? new Date(raw) : null;
    if (saved && !Number.isNaN(saved.getTime())) return saved > floor ? saved : floor;
  } catch {
    // Unreadable: fall through to the first-look default.
  }
  // First look on this install: today only, not a week of history nobody asked about.
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function describe(block: MissedBlock, now: Date): string {
  const day = isSameDay(block.startAt, now)
    ? ''
    : isSameDay(block.startAt, new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
      ? 'Ayer '
      : `${DAY_ABBREVIATIONS_ES[block.startAt.getDay()]} ${block.startAt.getDate()} `;
  const time = `${hhmm(block.startAt.getHours() * 60 + block.startAt.getMinutes())}-${hhmm(block.endAt.getHours() * 60 + block.endAt.getMinutes())}`;
  return `• ${day}${time} ${block.label ?? 'Bloque de trabajo'}${block.running ? ' (en curso)' : ''}`;
}

export function useMissedBlocks(): void {
  const { startBlock, session, isLoading } = usePomodoro();
  const checking = useRef(false);
  const lastShown = useRef({ key: '', at: 0 });
  const state = useRef({ startBlock, active: !!session?.active });
  state.current = { startBlock, active: !!session?.active };

  // Waits for the current session to load once, so a block already running isn't called missed;
  // later loads (every pomodoro change refetches) don't re-check.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!isLoading) setReady(true);
  }, [isLoading]);

  useEffect(() => {
    if (!ready) return;

    const check = async () => {
      if (checking.current) return;
      checking.current = true;
      try {
        const now = new Date();
        const since = await loadCheckedAt(now);
        const snapshot = await pullSnapshot();
        const missed = missedBlocks({
          schedules: snapshot.schedules,
          sessions: snapshot.pomodoroSessions ?? [],
          completions: snapshot.scheduleCompletions ?? [],
          since,
          now,
        });
        // Blocks still running are asked about again next time; finished ones are reported once.
        const settled = missed.filter((b) => !b.running);
        const next = settled.length ? new Date(Math.max(since.getTime(), settled[settled.length - 1].startAt.getTime() + 1)) : since;
        const running = missed.find((b) => b.running);
        const markTo = running ? next : now;
        await platformStorage.setItem(CHECKED_AT_KEY, markTo.toISOString()).catch(() => undefined);
        // Nothing new since the last alert (only the same running block): don't ask again so soon.
        const key = missed.map((b) => `${b.scheduleId}@${b.startAt.getTime()}`).join(',');
        const repeat = settled.length === 0 && key === lastShown.current.key && now.getTime() - lastShown.current.at < RUNNING_REPEAT_MS;
        if (missed.length && !repeat) {
          lastShown.current = { key, at: now.getTime() };
          show(missed, snapshot.tasks, snapshot.schedules, now, state.current);
        }
      } catch {
        // Offline with no cache: nothing to compare against, try again next time.
      } finally {
        checking.current = false;
      }
    };

    void check();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void check();
    });
    return () => subscription.remove();
  }, [ready]);
}

function show(
  missed: MissedBlock[],
  tasks: SyncTaskRecord[],
  schedules: SyncScheduleRecord[],
  now: Date,
  { startBlock, active }: { startBlock: ReturnType<typeof usePomodoro>['startBlock']; active: boolean },
): void {
  const running = active ? undefined : missed.find((b) => b.running);
  const title = missed.length === 1 ? 'Un bloque sin iniciar' : `${missed.length} bloques sin iniciar`;
  const body = missed.map((b) => describe(b, now)).join('\n');

  const buttons: Parameters<typeof Alert.alert>[2] = [{ text: 'Ver calendario', onPress: () => router.push('/calendar') }];
  if (running) {
    const config = schedules.find((s) => s.id === running.scheduleId);
    const block = blockToday(
      {
        scheduleId: running.scheduleId,
        startMinute: running.startAt.getHours() * 60 + running.startAt.getMinutes(),
        endMinute: running.endAt.getHours() * 60 + running.endAt.getMinutes(),
        pomodoroMin: config?.pomodoroMin,
        shortBreakMin: config?.shortBreakMin,
      },
      tasks,
      now,
    );
    buttons.push({
      text: `Iniciar ahora (${ATTENTION_PROFILE_SPECS[block.profile].name})`,
      onPress: () =>
        void startBlock({
          scheduleId: running.scheduleId,
          blockStartAt: running.startAt,
          blockEndAt: block.endAt,
          profile: block.profile,
          taskId: block.tasks[0]?.id ?? null,
          timing: { focusMin: block.focusMin, breakMin: block.breakMin },
        }),
    });
  }
  buttons.push({ text: 'OK', style: 'cancel' });
  Alert.alert(title, body, buttons);
}
