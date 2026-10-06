import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppButton, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import {
  ATTENTION_PROFILE_SPECS,
  BLOCK_EXIT_REASONS,
  MAX_BLOCK_REMINDERS,
  describeOccurrence,
  finishPomodoroPhrase,
  localDayKey,
  nextBlockOccurrence,
  studyProgress,
  studySessionLine,
} from '@calendar/shared';
import { usePomodoro } from '../../context/PomodoroContext';
import { useSchedules } from '../../hooks/useSchedules';
import { useTasks } from '../../hooks/useTasks';
import { isDesktop } from '../../lib/desktop';
import { logFocusEvent } from '../../lib/focusEvents/log';
import { syncBatch } from '../../lib/offline/sync-client';
import { formatTimer } from '../../lib/pomodoro/timer';

// The WORK block's pomodoro over everything (user-requested, 2026-10-06/07). It comes up when the
// block's session starts and, on the desktop, when the user comes back to the PC after a while
// away -- at most MAX_BLOCK_REMINDERS times per block, since more breaks the focus it's for. The
// window is brought to the front above other apps until it's answered:
// - "Seguir trabajando": hides it, the time keeps counting.
// - "Salir": asks why, then either "vuelvo en un rato" (the session pauses: time stops, the exit
//   counts; a small bar offers "Volver al bloque") or "no hago este bloque" (the session ends, the
//   block is marked "no puedo" today with the reason, and its study session moves to the line's
//   next block by staying pending).
// It also says which study session the block is on, and asks at the block's end whether it got done.

const RETURN_IDLE_SECONDS = 90;
const IDLE_POLL_MS = 5_000;

const PHASES: Record<string, string> = {
  FOCUS: 'Enfoque',
  SHORT_BREAK: 'Pausa',
  LONG_BREAK: 'Pausa larga',
};

async function setOnTop(show: boolean) {
  if (!isDesktop) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('focus_overlay', { show });
  } catch {
    // Older desktop build: the card still shows inside the window.
  }
}

const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 9999,
  backgroundColor: 'rgba(18, 21, 27, 0.94)',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '$6',
} as const;

const cardStyle = {
  width: '100%',
  maxWidth: 580,
  borderWidth: 2,
  borderColor: '$accent',
  borderRadius: '$8',
  backgroundColor: 'rgba(33, 40, 54, 0.96)',
  padding: '$6',
  gap: '$3',
} as const;

export function BlockFocusOverlay() {
  const pomodoro = usePomodoro();
  const { schedules } = useSchedules();
  const { tasks, completeTask } = useTasks();
  const session = pomodoro.session;
  const inBlock = !!session?.active && !!session.scheduleId;
  const isOut = inBlock && !!session?.pausedAt;
  const [visible, setVisible] = useState(false);
  const [askingWhy, setAskingWhy] = useState(false);
  const [reason, setReason] = useState('');
  const [endedSession, setEndedSession] = useState<{ taskId: string; scheduleId: string } | null>(null);
  const shownFor = useRef<string | null>(null);
  const shows = useRef<Record<string, number>>({});

  const show = (sessionId: string) => {
    const count = shows.current[sessionId] ?? 0;
    if (count >= MAX_BLOCK_REMINDERS) return;
    shows.current[sessionId] = count + 1;
    setVisible(true);
  };

  // Comes up once per block session (its start, or the first time this window sees it).
  useEffect(() => {
    if (!inBlock || isOut || !session) return;
    if (shownFor.current === session.id) return;
    shownFor.current = session.id;
    show(session.id);
  }, [inBlock, isOut, session]);

  // Back at the PC after a while away: show it again (within the limit).
  useEffect(() => {
    if (!isDesktop || !inBlock || isOut || !session) return;
    const sessionId = session.id;
    let away = false;
    let cancelled = false;
    const timer = window.setInterval(() => {
      void import('@tauri-apps/api/core')
        .then(({ invoke }) => invoke<number>('idle_seconds'))
        .then((idle) => {
          if (cancelled) return;
          if (idle >= RETURN_IDLE_SECONDS) away = true;
          else if (away && idle < IDLE_POLL_MS / 1000) {
            away = false;
            show(sessionId);
          }
        })
        .catch(() => undefined);
    }, IDLE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [inBlock, isOut, session?.id]);

  // The block reached its end with a study session in it: ask whether it got done.
  const previous = useRef(session);
  useEffect(() => {
    const before = previous.current;
    previous.current = session;
    if (!before?.active || !before.scheduleId || !before.taskId || !session) return;
    if (session.id !== before.id || session.active || session.interrupted) return;
    const task = tasks.find((t) => t.id === before.taskId);
    if (task && task.status !== 'COMPLETED') setEndedSession({ taskId: task.id, scheduleId: before.scheduleId });
  }, [session, tasks]);

  const showCard = (visible && inBlock && !isOut) || !!endedSession;
  useEffect(() => {
    void setOnTop(showCard);
  }, [showCard]);

  if (typeof document === 'undefined') return null;

  if (endedSession) {
    const task = tasks.find((t) => t.id === endedSession.taskId);
    const answer = (done: boolean) => {
      if (done && task) void completeTask(task, task.estimatedMinutes);
      logFocusEvent({ kind: 'CHECK_IN', scheduleId: endedSession.scheduleId, taskId: endedSession.taskId, meta: { sessionDone: done } });
      setEndedSession(null);
    };
    return createPortal(
      <YStack {...overlayStyle}>
        <YStack {...cardStyle} alignItems="center">
          <Text color="$accent" fontWeight="700" textTransform="uppercase" letterSpacing={1}>
            Terminó el bloque
          </Text>
          <Text fontSize="$6" fontWeight="800" textAlign="center">
            ¿Completaste la sesión?
          </Text>
          <Paragraph margin={0} textAlign="center">
            {task?.title}
          </Paragraph>
          <XStack gap="$3" marginTop="$3" flexWrap="wrap" justifyContent="center">
            <AppButton variant="primary" onPress={() => answer(true)}>
              Sí, completada
            </AppButton>
            <AppButton variant="ghost" onPress={() => answer(false)}>
              No, pasa al próximo bloque
            </AppButton>
          </XStack>
        </YStack>
      </YStack>,
      document.body,
    );
  }

  if (!inBlock || !session) return null;

  const schedule = schedules.find((s) => s.id === session.scheduleId);
  const task = session.taskId ? tasks.find((t) => t.id === session.taskId) : null;
  const profile = session.attentionProfile ? ATTENTION_PROFILE_SPECS[session.attentionProfile].name : null;
  const exits = session.exitCount ?? 0;
  // The pomodoro's own countdown (frozen while out): total minus what already passed.
  const remaining = pomodoro.remainingSeconds;
  const phraseSeed = `${session.id}:${session.completedCycles}:${session.state}`;
  const exitsLabel = exits === 0 ? 'Sin salidas en este bloque' : `Saliste ${exits} ${exits === 1 ? 'vez' : 'veces'} de este bloque`;
  const next = schedule ? nextBlockOccurrence(schedule, new Date()) : null;

  async function leave(reschedule: boolean) {
    if (!session?.scheduleId) return;
    const trimmed = reason.trim() || undefined;
    const scheduleId = session.scheduleId;
    setAskingWhy(false);
    setVisible(false);
    setReason('');
    if (reschedule) {
      await pomodoro.cancel();
      const now = new Date();
      await syncBatch({
        scheduleCompletions: [
          { clientId: crypto.randomUUID(), updatedAt: now.toISOString(), scheduleId, date: localDayKey(now), status: 'SKIPPED', reason: trimmed ?? null },
        ],
      }).catch(() => undefined);
    } else {
      await pomodoro.pause();
    }
    logFocusEvent({
      kind: 'BLOCK_EXIT_REASON',
      scheduleId,
      pomodoroSessionId: session.id,
      taskId: session.taskId ?? undefined,
      meta: { reason: trimmed, rescheduled: reschedule, nextAt: reschedule ? next?.toISOString() : undefined, device: 'desktop' },
    });
  }

  if (isOut) {
    return createPortal(
      <XStack
        position="fixed"
        bottom={16}
        right={16}
        zIndex={9998}
        gap="$3"
        alignItems="center"
        padding="$3"
        borderRadius="$6"
        backgroundColor="rgba(33, 40, 54, 0.96)"
        borderWidth={1}
        borderColor="rgba(224,184,74,0.6)"
      >
        <YStack>
          <Text fontWeight="700">Fuera del bloque · el tiempo no cuenta</Text>
          <Text fontSize="$2" color="$muted">
            {schedule?.label ?? 'Bloque de trabajo'} · {exitsLabel}
          </Text>
          <Text fontSize="$2">
            Te faltan <Text fontWeight="700">{formatTimer(remaining)}</Text> de este pomodoro
          </Text>
          <Text fontSize="$2" color="$accent">
            {finishPomodoroPhrase(remaining / 60, phraseSeed, true)}
          </Text>
        </YStack>
        <AppButton variant="primary" disabled={pomodoro.isMutating} onPress={() => void pomodoro.resume()}>
          Volver al bloque
        </AppButton>
      </XStack>,
      document.body,
    );
  }

  if (!showCard) return null;

  if (askingWhy) {
    return createPortal(
      <YStack {...overlayStyle}>
        <YStack {...cardStyle}>
          <Text fontSize="$6" fontWeight="800">
            Salir del bloque
          </Text>
          <Paragraph margin={0} color="$muted">
            {schedule?.label ?? 'Bloque de trabajo'}
            {task ? ` · ${task.title}` : ''}
          </Paragraph>
          <Text fontWeight="700">¿Por qué?</Text>
          <XStack gap="$2" flexWrap="wrap">
            {BLOCK_EXIT_REASONS.map((option) => (
              <AppButton key={option} variant={reason === option ? 'primary' : 'ghost'} onPress={() => setReason(option)}>
                {option}
              </AppButton>
            ))}
          </XStack>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="O escribe el motivo (opcional)"
            style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'inherit', fontSize: 15 }}
          />
          <XStack gap="$3" flexWrap="wrap" marginTop="$2">
            <AppButton variant="primary" disabled={pomodoro.isMutating} onPress={() => void leave(false)}>
              Vuelvo en un rato (pausa el tiempo)
            </AppButton>
            <AppButton variant="ghost" disabled={pomodoro.isMutating} onPress={() => void leave(true)}>
              No hago este bloque hoy (reprogramar)
            </AppButton>
            <AppButton variant="ghost" onPress={() => setAskingWhy(false)}>
              Seguir en el bloque
            </AppButton>
          </XStack>
          <Paragraph margin={0} color="$muted" fontSize="$2">
            {task
              ? `Si lo reprogramas, «${task.title}» queda pendiente y pasa al próximo bloque${next ? `: ${describeOccurrence(next)}` : ''}.`
              : `Si lo reprogramas, el bloque queda como "no puedo" hoy${next ? ` y vuelve ${describeOccurrence(next)}` : ''}.`}
          </Paragraph>
        </YStack>
      </YStack>,
      document.body,
    );
  }

  const progress = studyProgress(tasks).filter((line) => line.total > 0);

  return createPortal(
    <YStack {...overlayStyle}>
      <YStack {...cardStyle} alignItems="center">
        <Text color="$accent" fontWeight="700" textTransform="uppercase" letterSpacing={1}>
          Bloque de trabajo
        </Text>
        <Text fontSize="$7" fontWeight="800" textAlign="center">
          {schedule?.label ?? 'Horario de trabajo'}
        </Text>
        <Paragraph margin={0} color="$muted">
          {[PHASES[session.state] ?? session.state, profile, `ciclo ${session.completedCycles + (session.state === 'FOCUS' ? 1 : 0)}`]
            .filter(Boolean)
            .join(' · ')}
        </Paragraph>
        {task ? (
          <Text textAlign="center" color={task.status === 'COMPLETED' ? '$accent' : '$color'}>
            {studySessionLine(task, session)}
          </Text>
        ) : null}
        <Text fontSize={72} fontWeight="800" lineHeight={80} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatTimer(remaining)}
        </Text>
        <Paragraph margin={0} color="$muted" marginTop={-8}>
          {session.state === 'FOCUS' ? 'para terminar este pomodoro' : 'de descanso'}
        </Paragraph>
        {session.state === 'FOCUS' ? (
          <Text color="$accent" fontWeight="700" textAlign="center">
            {finishPomodoroPhrase(remaining / 60, phraseSeed)}
          </Text>
        ) : null}
        <Text color={exits > 0 ? '$warning' : '$muted'} fontWeight="600">
          {exitsLabel}
        </Text>
        {progress.length > 0 && task ? (
          <Text fontSize="$2" color="$muted" textAlign="center">
            {progress.map((line) => `${line.name} ${line.done}/${line.total}`).join(' · ')}
          </Text>
        ) : null}
        <XStack gap="$3" marginTop="$3" flexWrap="wrap" justifyContent="center">
          <AppButton variant="primary" onPress={() => setVisible(false)}>
            Seguir trabajando
          </AppButton>
          {task && task.status !== 'COMPLETED' ? (
            <AppButton variant="ghost" onPress={() => void completeTask(task, task.estimatedMinutes)}>
              Sesión completada
            </AppButton>
          ) : null}
          <AppButton variant="ghost" disabled={pomodoro.isMutating} onPress={() => setAskingWhy(true)}>
            Salir
          </AppButton>
        </XStack>
      </YStack>
    </YStack>,
    document.body,
  );
}
