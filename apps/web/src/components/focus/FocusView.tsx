import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BLOCK_DONE_FOCUS_MIN,
  FOCUS_MIN_MAX,
  FOCUS_MIN_MIN,
  FOCUS_MIN_STEP,
  clampFocusMin,
  currentSegment,
  flexibleSegments,
  nextFlexibleWork,
  pauseOverrunMinutes,
  studySessionLine,
} from '@calendar/shared';
import { AppButton, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { usePomodoro } from '../../context/PomodoroContext';
import { useSchedules } from '../../hooks/useSchedules';
import { useTasks } from '../../hooks/useTasks';
import { focusView, phaseKey, useFocusViewState } from '../../lib/focusView/store';
import { formatTimer } from '../../lib/pomodoro/timer';
import { studySectionsOf } from '../../lib/studyGame/studySections';
import type { SyncPomodoroRecord } from '../../lib/pomodoro/types';
import { SequenceTimeline } from '../pomodoro/SequenceTimeline';
import { TutorPanel } from '../tutor/TutorPanel';

// The focus view (dynamic-study-blocks D17, user-requested 2026-10-22): while a block's pomodoro
// runs, the app window shows only the pomodoro -- timer, segment, the block's plan, the controls for
// the phase and, in study blocks, the tutor -- instead of the navigation and a page. It lives inside
// the app's own window: nothing comes up over other apps and the window isn't brought to the front
// (the 2026-10-06 rule). "Ver la app" collapses it to the pill for the rest of the phase. A plain
// pomodoro keeps SoftFocusOverlay, which already fills the window during its focus.

/** Whether the focus view is showing for this session (the pill hides while it is). */
export function useFocusViewVisible(session: SyncPomodoroRecord | null): boolean {
  const { collapsedFor } = useFocusViewState();
  return (
    !!session?.active &&
    !!session.scheduleId &&
    !session.pausedAt &&
    collapsedFor !== phaseKey(session)
  );
}

function FlexiblePlan({ session }: { session: SyncPomodoroRecord }) {
  const segments = flexibleSegments(session);
  const running = session.segmentIndex ?? -1;
  const focus = session.focusMinutes ?? 0;
  return (
    <YStack gap="$1" width="100%">
      {segments.map((segment) => (
        <XStack
          key={segment.index}
          gap="$3"
          paddingVertical="$1"
          paddingHorizontal="$2"
          borderRadius="$3"
          backgroundColor={segment.index === running ? 'rgba(255,255,255,0.08)' : 'transparent'}
          opacity={segment.index < running ? 0.5 : 1}
        >
          <Text
            fontSize="$2"
            color="$muted"
            width={56}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {segment.minutos} min
          </Text>
          <Text
            flex={1}
            fontSize="$3"
            fontWeight={segment.index === running ? '800' : '400'}
            color={segment.tipo === 'pausa' ? '$muted' : '$color'}
          >
            {segment.etiqueta}
          </Text>
        </XStack>
      ))}
      <Text fontSize="$2" color={focus >= BLOCK_DONE_FOCUS_MIN ? '$accent' : '$muted'}>
        Foco real: {focus} min
        {focus >= BLOCK_DONE_FOCUS_MIN
          ? ' · bloque cumplido'
          : ` · se cumple a los ${BLOCK_DONE_FOCUS_MIN}`}
        {(session.cutCount ?? 0) > 0
          ? ` · ${session.cutCount} ${session.cutCount === 1 ? 'tramo cortado' : 'tramos cortados'}`
          : ''}
      </Text>
    </YStack>
  );
}

/** The pause screen's control: the next focus's length (20-40) and starting it, or the closing. */
function NextWork({ session }: { session: SyncPomodoroRecord }) {
  const { startFocus, endBlock, isMutating } = usePomodoro();
  const next = nextFlexibleWork(session);
  const [minutes, setMinutes] = useState(next?.minutes ?? 30);
  const key = phaseKey(session);
  // A new pause proposes again (the plan's next focus, capped after cuts).
  useEffect(() => {
    if (next?.tipo === 'foco') setMinutes(next.minutes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!next) {
    return (
      <AppButton variant="primary" disabled={isMutating} onPress={() => void endBlock()}>
        Terminar bloque
      </AppButton>
    );
  }
  if (next.tipo === 'cierre') {
    return (
      <YStack gap="$2" alignItems="center">
        {next.closingOnly ? (
          <Paragraph margin={0} color="$muted" textAlign="center">
            Ya son más de las 12:00: no empieza otro foco, sigue el cierre.
          </Paragraph>
        ) : null}
        <AppButton variant="primary" disabled={isMutating} onPress={() => void startFocus()}>
          Empezar cierre ({next.minutes} min)
        </AppButton>
      </YStack>
    );
  }
  return (
    <YStack gap="$2" alignItems="center">
      <XStack gap="$2" alignItems="center">
        <AppButton
          variant="ghost"
          disabled={minutes <= FOCUS_MIN_MIN}
          onPress={() => setMinutes(clampFocusMin(minutes - FOCUS_MIN_STEP))}
        >
          −
        </AppButton>
        <AppButton variant="primary" disabled={isMutating} onPress={() => void startFocus(minutes)}>
          {`Empezar foco de ${minutes} min`}
        </AppButton>
        <AppButton
          variant="ghost"
          disabled={minutes >= FOCUS_MIN_MAX}
          onPress={() => setMinutes(clampFocusMin(minutes + FOCUS_MIN_STEP))}
        >
          +
        </AppButton>
      </XStack>
      {(session.cutCount ?? 0) > 0 &&
      next.minutes < (session.sequence?.find((s) => s.tipo === 'foco')?.minutos ?? 0) ? (
        <Text fontSize="$2" color="$muted">
          Propuesta más corta porque cortaste un tramo.
        </Text>
      ) : null}
    </YStack>
  );
}

export function FocusView() {
  const pomodoro = usePomodoro();
  const { schedules } = useSchedules();
  const { tasks } = useTasks();
  const session = pomodoro.session;
  const visible = useFocusViewVisible(session);

  if (!visible || !session || typeof document === 'undefined') return null;

  const key = phaseKey(session);
  const schedule = schedules.find((s) => s.id === session.scheduleId);
  const task = session.taskId ? tasks.find((t) => t.id === session.taskId) : null;
  const segment = currentSegment(session);
  const focus = session.state === 'FOCUS';
  const flexible = !!session.flexible;
  const overrun = flexible && !focus ? pauseOverrunMinutes(session, Date.now()) : 0;
  const withTutor = !!task && !!studySectionsOf(task);
  const phaseLabel = segment?.etiqueta ?? (focus ? 'Foco' : 'Pausa');

  return createPortal(
    <XStack
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={9990}
      backgroundColor="$background"
      padding="$5"
      gap="$5"
      flexWrap="wrap"
      style={{ overflowY: 'auto', overflowX: 'hidden' }}
      alignItems="flex-start"
    >
      <YStack flex={1} minWidth={320} gap="$4" alignItems="center">
        <XStack
          width="100%"
          justifyContent="space-between"
          alignItems="center"
          gap="$3"
          flexWrap="wrap"
        >
          <YStack>
            <Text color="$accent" fontWeight="700" textTransform="uppercase" letterSpacing={1}>
              {schedule?.label ?? 'Bloque de trabajo'}
            </Text>
            {task ? (
              <Text color="$muted" fontSize="$3">
                {studySessionLine(task, session)}
              </Text>
            ) : null}
          </YStack>
          <AppButton variant="ghost" onPress={() => focusView.collapse(key)}>
            Ver la app
          </AppButton>
        </XStack>

        <Text fontSize="$4" fontWeight="700" textAlign="center">
          {overrun > 0 ? 'Pausa terminada' : phaseLabel}
        </Text>
        <Text
          fontSize={96}
          lineHeight={104}
          fontWeight="800"
          color={overrun > 0 ? '$warning' : focus ? '$color' : '$muted'}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {overrun > 0
            ? `+${formatTimer(Math.floor(overrun * 60))}`
            : formatTimer(pomodoro.remainingSeconds)}
        </Text>

        {flexible && !focus ? <NextWork session={session} /> : null}

        <XStack gap="$3" flexWrap="wrap" justifyContent="center">
          {flexible && focus && pomodoro.canCutSegment ? (
            <AppButton
              variant="ghost"
              disabled={pomodoro.isMutating}
              onPress={() => void pomodoro.cutSegment()}
            >
              Cortar tramo (ir a la pausa)
            </AppButton>
          ) : null}
          {flexible ? (
            <AppButton
              variant="ghost"
              disabled={pomodoro.isMutating}
              onPress={() => void pomodoro.endBlock()}
            >
              Terminar bloque
            </AppButton>
          ) : null}
          <AppButton variant="ghost" onPress={() => focusView.requestExit(key)}>
            Salir
          </AppButton>
        </XStack>

        <YStack width="100%" maxWidth={560}>
          {flexible ? <FlexiblePlan session={session} /> : <SequenceTimeline />}
        </YStack>
      </YStack>

      {withTutor ? (
        <YStack flex={1} minWidth={360} maxWidth={720}>
          <TutorPanel />
        </YStack>
      ) : null}
    </XStack>,
    document.body,
  );
}
