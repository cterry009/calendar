import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppButton, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { ATTENTION_PROFILE_SPECS } from '@calendar/shared';
import { usePomodoro } from '../../context/PomodoroContext';
import { useSchedules } from '../../hooks/useSchedules';
import { useTasks } from '../../hooks/useTasks';
import { isDesktop } from '../../lib/desktop';
import { formatTimer } from '../../lib/pomodoro/timer';

// The WORK block's pomodoro over everything (user-requested, 2026-10-06). It comes up when the
// block's session starts and, on the desktop, when the user comes back to the PC after a while
// away; the window is brought to the front above other apps until it's answered:
// - "Seguir trabajando": hides it, the time keeps counting.
// - "Salir": the session pauses -- the time stops and the exit is counted -- for when the user has
//   to go do something else. While out, a small bar offers "Volver al bloque".
// Unlike the phone's overlay it doesn't stay up: on the PC the work itself happens in other apps.

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

export function BlockFocusOverlay() {
  const pomodoro = usePomodoro();
  const { schedules } = useSchedules();
  const { tasks } = useTasks();
  const session = pomodoro.session;
  const inBlock = !!session?.active && !!session.scheduleId;
  const isOut = inBlock && !!session?.pausedAt;
  const [visible, setVisible] = useState(false);
  const shownFor = useRef<string | null>(null);

  // Comes up once per block session (its start, or the first time this window sees it).
  useEffect(() => {
    if (!inBlock || isOut || !session) return;
    if (shownFor.current === session.id) return;
    shownFor.current = session.id;
    setVisible(true);
  }, [inBlock, isOut, session]);

  // Back at the PC after a while away: show it again.
  useEffect(() => {
    if (!isDesktop || !inBlock || isOut) return;
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
            setVisible(true);
          }
        })
        .catch(() => undefined);
    }, IDLE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [inBlock, isOut]);

  const showCard = visible && inBlock && !isOut;
  useEffect(() => {
    void setOnTop(showCard);
  }, [showCard]);

  if (!inBlock || !session || typeof document === 'undefined') return null;

  const schedule = schedules.find((s) => s.id === session.scheduleId);
  const task = session.taskId ? tasks.find((t) => t.id === session.taskId) : null;
  const profile = session.attentionProfile ? ATTENTION_PROFILE_SPECS[session.attentionProfile].name : null;
  const exits = session.exitCount ?? 0;
  const exitsLabel = exits === 0 ? 'Sin salidas en este bloque' : `Saliste ${exits} ${exits === 1 ? 'vez' : 'veces'} de este bloque`;

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
        </YStack>
        <AppButton variant="primary" disabled={pomodoro.isMutating} onPress={() => void pomodoro.resume()}>
          Volver al bloque
        </AppButton>
      </XStack>,
      document.body,
    );
  }

  if (!showCard) return null;

  return createPortal(
    <YStack
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={9999}
      backgroundColor="rgba(18, 21, 27, 0.94)"
      justifyContent="center"
      alignItems="center"
      padding="$6"
    >
      <YStack
        width="100%"
        maxWidth={560}
        borderWidth={2}
        borderColor="$accent"
        borderRadius="$8"
        backgroundColor="rgba(33, 40, 54, 0.96)"
        padding="$6"
        gap="$3"
        alignItems="center"
      >
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
        <Text fontSize={72} fontWeight="800" lineHeight={80} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatTimer(pomodoro.remainingSeconds)}
        </Text>
        {task ? (
          <Paragraph margin={0}>
            Tarea: <Text fontWeight="700">{task.title}</Text>
          </Paragraph>
        ) : null}
        <Text color={exits > 0 ? '$warning' : '$muted'} fontWeight="600">
          {exitsLabel}
        </Text>
        <XStack gap="$3" marginTop="$3" flexWrap="wrap" justifyContent="center">
          <AppButton variant="primary" onPress={() => setVisible(false)}>
            Seguir trabajando
          </AppButton>
          <AppButton
            variant="ghost"
            disabled={pomodoro.isMutating}
            onPress={() => {
              setVisible(false);
              void pomodoro.pause();
            }}
          >
            Salir (deja de contar el tiempo)
          </AppButton>
        </XStack>
      </YStack>
    </YStack>,
    document.body,
  );
}
