import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppButton, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { ATTENTION_PROFILE_SPECS, blockOnDay, type FocusEventKind } from '@calendar/shared';
import { usePomodoro } from '../../context/PomodoroContext';
import { useCalendarData } from '../../hooks/useCalendarData';
import { isDesktop } from '../../lib/desktop';
import { notifySystem } from '../../lib/desktop/notify';
import { logFocusEvent } from '../../lib/focusEvents/log';
import type { SyncSchedule } from '../../lib/calendar/types';

// The phone's block-start prompt, on desktop and web (user-requested, 2026-10-01): when a WORK
// block starts, ask whether to start it -- "Iniciar" runs a block-mode pomodoro with the block's
// attention profile on its first task, "En 5 min" asks again, "Hoy no" lets it go. Windows
// notifications from Tauri can't carry buttons, so the desktop raises its window and asks here,
// with a system notification alongside. Every answer is logged as a FocusEvent, like on the phone.

const CHECK_INTERVAL_MS = 20_000;
/** A block that started less than this long ago still gets its prompt (app opened late, sleep). */
const GRACE_MIN = 10;
const SNOOZE_MIN = 5;
const ASKED_KEY = 'calendar:block-prompts-asked';

interface Prompt {
  schedule: SyncSchedule;
  /** The day it was asked for, local midnight-based key. */
  key: string;
  startAt: Date;
  snoozes: number;
}

function hhmm(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

function promptKey(scheduleId: string, day: Date): string {
  return `${scheduleId}@${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`;
}

function readAsked(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(ASKED_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function markAsked(key: string): void {
  try {
    // Keep the last few days only.
    window.localStorage.setItem(ASKED_KEY, JSON.stringify([...readAsked().slice(-60), key]));
  } catch {
    // Without storage a reload can ask twice; harmless.
  }
}

async function raiseWindow(): Promise<void> {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const win = getCurrentWindow();
  await win.show();
  await win.unminimize();
  await win.setFocus();
}


export function BlockStartPrompt() {
  const { schedules, tasks } = useCalendarData();
  const { session, startBlock } = usePomodoro();
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const snoozed = useRef<{ prompt: Prompt; until: number } | null>(null);
  const latest = useRef({ schedules, active: !!session?.active, prompt });
  latest.current = { schedules, active: !!session?.active, prompt };

  const open = useCallback((next: Prompt) => {
    setPrompt(next);
    const block = blockOnDay(next.schedule, tasks, next.startAt);
    const end = block.endAt.getHours() * 60 + block.endAt.getMinutes();
    void notifySystem(next.schedule.label ?? 'Bloque de trabajo', `${hhmm(next.schedule.startMinute)}-${hhmm(end)} · ¿Lo inicias?`);
    if (isDesktop) void raiseWindow().catch(() => undefined);
  }, [tasks]);

  useEffect(() => {
    function check() {
      const { schedules: all, active, prompt: showing } = latest.current;
      if (showing) return;
      const now = new Date();
      const snooze = snoozed.current;
      if (snooze && now.getTime() >= snooze.until) {
        snoozed.current = null;
        if (!active) open({ ...snooze.prompt, snoozes: snooze.prompt.snoozes + 1 });
        return;
      }
      if (active) return;
      const asked = new Set(readAsked());
      const minute = now.getHours() * 60 + now.getMinutes();
      for (const s of all) {
        if (s.kind !== 'WORK' || !s.enabled || !s.daysOfWeek.includes(now.getDay())) continue;
        if (minute < s.startMinute || minute >= Math.min(s.startMinute + GRACE_MIN, s.endMinute)) continue;
        const key = promptKey(s.id, now);
        if (asked.has(key)) continue;
        markAsked(key);
        const startAt = new Date(now);
        startAt.setHours(Math.floor(s.startMinute / 60), s.startMinute % 60, 0, 0);
        open({ schedule: s, key, startAt, snoozes: 0 });
        return;
      }
    }
    check();
    const interval = window.setInterval(check, CHECK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [open]);

  const answer = useCallback(
    async (kind: FocusEventKind) => {
      if (!prompt) return;
      setPrompt(null);
      const now = new Date();
      const block = blockOnDay(prompt.schedule, tasks, now);
      const base = {
        scheduleId: prompt.schedule.id,
        blockStartAt: prompt.startAt.toISOString(),
        attentionProfile: block.profile,
        taskId: block.tasks[0]?.id,
        value: Math.round((now.getTime() - prompt.startAt.getTime()) / 1000),
        meta: { snoozes: prompt.snoozes, tasksInBlock: block.tasks.length, device: isDesktop ? 'desktop' : 'web' },
      };
      if (kind === 'BLOCK_PROMPT_ACCEPTED') {
        const sessionId = await startBlock({
          scheduleId: prompt.schedule.id,
          blockStartAt: prompt.startAt,
          blockEndAt: block.endAt,
          profile: block.profile,
          taskId: block.tasks[0]?.id ?? null,
        });
        logFocusEvent({ kind, ...base, pomodoroSessionId: sessionId ?? undefined, meta: { ...base.meta, started: sessionId !== null } });
        return;
      }
      if (kind === 'BLOCK_PROMPT_SNOOZED') snoozed.current = { prompt, until: now.getTime() + SNOOZE_MIN * 60_000 };
      logFocusEvent({ kind, ...base });
    },
    [prompt, startBlock, tasks],
  );

  if (!prompt || typeof document === 'undefined') return null;

  const block = blockOnDay(prompt.schedule, tasks, prompt.startAt);
  const end = block.endAt.getHours() * 60 + block.endAt.getMinutes();
  const spec = ATTENTION_PROFILE_SPECS[block.profile];

  return createPortal(
    <YStack
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={90_000}
      backgroundColor="rgba(10, 12, 16, 0.7)"
      justifyContent="center"
      alignItems="center"
      padding="$6"
    >
      <YStack width="100%" maxWidth={480} borderWidth={2} borderColor="$accent" borderRadius="$8" backgroundColor="$background" padding="$6" gap="$4">
        <YStack gap="$1">
          <Text fontSize="$2" color="$muted" textTransform="uppercase" letterSpacing={1.5}>
            Empieza un bloque
          </Text>
          <Text fontWeight="800" fontSize="$7">
            {prompt.schedule.label ?? 'Bloque de trabajo'}
          </Text>
          <Paragraph margin={0} color="$muted">
            {hhmm(prompt.schedule.startMinute)}-{hhmm(end)} · {spec.name} ({spec.focusMin}/{spec.breakMin} min)
          </Paragraph>
          {block.tasks[0] ? (
            <Paragraph margin={0}>
              Primero: <Text fontWeight="700">{block.tasks[0].title}</Text>
            </Paragraph>
          ) : null}
        </YStack>
        <XStack gap="$3" justifyContent="flex-end" flexWrap="wrap">
          <AppButton variant="ghost" onPress={() => void answer('BLOCK_PROMPT_DECLINED')}>
            Hoy no
          </AppButton>
          <AppButton variant="ghost" onPress={() => void answer('BLOCK_PROMPT_SNOOZED')}>
            En {SNOOZE_MIN} min
          </AppButton>
          <AppButton variant="primary" onPress={() => void answer('BLOCK_PROMPT_ACCEPTED')}>
            Iniciar
          </AppButton>
        </XStack>
      </YStack>
    </YStack>,
    document.body,
  );
}
