import { useCallback, useEffect, useState } from 'react';
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
// pomodoro keeps SoftFocusOverlay, which already fills the window during its focus -- unless it's on a
// study session: then the tutor's chat is what the screen is for (user-requested, 2026-10-22), so
// the focus view takes it, blocks or not, with the chat as the wider column.

/** A study session with exercises (note and sections): the tutor goes with its pomodoro. */
export function isStudyTask(
  task: Parameters<typeof studySectionsOf>[0] | null | undefined,
): boolean {
  return !!task && !!studySectionsOf(task);
}

/** Whether the focus view is showing for this session (the pill hides while it is). */
export function useFocusViewVisible(
  session: SyncPomodoroRecord | null,
  tasks: Array<Parameters<typeof studySectionsOf>[0] & { id: string }>,
): boolean {
  const { collapsedFor } = useFocusViewState();
  const task = session?.taskId ? tasks.find((t) => t.id === session.taskId) : null;
  return (
    !!session?.active &&
    (!!session.scheduleId || isStudyTask(task)) &&
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

// The layout is the user's to adjust (2026-10-22): the pomodoro is a narrow column on the left and the
// tutor's chat takes the rest of the screen, edge to edge; the divider between them drags, and the
// timer and the chat each have their own size (A− / A+). Kept per device in localStorage.
const LAYOUT_KEY = 'calendar:focus-view-layout';
const MIN_LEFT = 220;
const DEFAULT_LAYOUT = { leftWidth: 320, timerScale: 1, chatZoom: 1 };
type Layout = typeof DEFAULT_LAYOUT;

function loadLayout(): Layout {
  try {
    const raw = window.localStorage.getItem(LAYOUT_KEY);
    return raw ? { ...DEFAULT_LAYOUT, ...(JSON.parse(raw) as Partial<Layout>) } : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function useLayout(): [Layout, (patch: Partial<Layout>) => void] {
  const [layout, setLayout] = useState<Layout>(() =>
    typeof window === 'undefined' ? DEFAULT_LAYOUT : loadLayout(),
  );
  const update = useCallback((patch: Partial<Layout>) => {
    setLayout((current) => {
      const next = { ...current, ...patch };
      try {
        window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(next));
      } catch {
        // Private mode: the sizes just aren't remembered.
      }
      return next;
    });
  }, []);
  return [layout, update];
}

const clampScale = (n: number) => Math.round(Math.min(1.6, Math.max(0.7, n)) * 10) / 10;

function SizeControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <XStack gap="$1" alignItems="center">
      <Text fontSize="$1" color="$muted">
        {label}
      </Text>
      <AppButton
        variant="ghost"
        size="$2"
        disabled={value <= 0.7}
        onPress={() => onChange(clampScale(value - 0.1))}
      >
        A−
      </AppButton>
      <AppButton
        variant="ghost"
        size="$2"
        disabled={value >= 1.6}
        onPress={() => onChange(clampScale(value + 0.1))}
      >
        A+
      </AppButton>
    </XStack>
  );
}

export function FocusView() {
  const pomodoro = usePomodoro();
  const { schedules } = useSchedules();
  const { tasks } = useTasks();
  const session = pomodoro.session;
  const visible = useFocusViewVisible(session, tasks);
  const [layout, setLayout] = useLayout();
  const [dragging, setDragging] = useState(false);
  const [viewport, setViewport] = useState(() =>
    typeof window === 'undefined' ? 1400 : window.innerWidth,
  );

  useEffect(() => {
    const onResize = () => setViewport(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Dragging the divider: the left column follows the pointer, between 220 px and 60 % of the window.
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const max = Math.max(MIN_LEFT, window.innerWidth * 0.6);
      setLayout({ leftWidth: Math.round(Math.min(max, Math.max(MIN_LEFT, e.clientX - 12))) });
    };
    const onUp = () => setDragging(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = '';
    };
  }, [dragging, setLayout]);

  // The page behind keeps its own scrollbar otherwise: the view covers the whole window.
  useEffect(() => {
    if (!visible) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [visible]);

  if (!visible || !session || typeof document === 'undefined') return null;

  const key = phaseKey(session);
  const schedule = schedules.find((s) => s.id === session.scheduleId);
  const task = session.taskId ? tasks.find((t) => t.id === session.taskId) : null;
  const segment = currentSegment(session);
  const focus = session.state === 'FOCUS';
  const flexible = !!session.flexible;
  const overrun = flexible && !focus ? pauseOverrunMinutes(session, Date.now()) : 0;
  const withTutor = isStudyTask(task);
  const inBlock = !!session.scheduleId;
  const phaseLabel = segment?.etiqueta ?? (focus ? 'Foco' : 'Pausa');
  // A narrow window stacks the pomodoro over the chat instead of side by side.
  const stacked = withTutor && viewport < 760;
  const leftWidth =
    withTutor && !stacked
      ? Math.min(layout.leftWidth, Math.max(MIN_LEFT, viewport * 0.6))
      : undefined;
  // The timer grows with its column and with its own size control.
  const timerSize = Math.round(
    Math.min(120, Math.max(40, (leftWidth ?? 420) * 0.24)) * layout.timerScale,
  );

  const pomodoroColumn = (
    <YStack
      width={leftWidth}
      flex={withTutor ? undefined : 1}
      flexShrink={0}
      gap="$3"
      alignItems="center"
      style={{ overflowY: 'auto', overflowX: 'hidden' }}
      maxHeight={stacked ? undefined : '100%'}
      paddingRight="$2"
    >
      <XStack
        width="100%"
        justifyContent="space-between"
        alignItems="flex-start"
        gap="$2"
        flexWrap="wrap"
      >
        <YStack flex={1} minWidth={140}>
          <Text
            color="$accent"
            fontWeight="700"
            textTransform="uppercase"
            letterSpacing={1}
            fontSize="$3"
          >
            {schedule?.label ?? (inBlock ? 'Bloque de trabajo' : 'Pomodoro de estudio')}
          </Text>
          {task ? (
            <Text color="$muted" fontSize="$2">
              {studySessionLine(task, session)}
            </Text>
          ) : null}
        </YStack>
        <AppButton variant="ghost" size="$3" onPress={() => focusView.collapse(key)}>
          Ver la app
        </AppButton>
      </XStack>

      <Text fontSize="$3" fontWeight="700" textAlign="center">
        {overrun > 0 ? 'Pausa terminada' : phaseLabel}
      </Text>
      <Text
        fontSize={timerSize}
        lineHeight={Math.round(timerSize * 1.08)}
        fontWeight="800"
        color={overrun > 0 ? '$warning' : focus ? '$color' : '$muted'}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {overrun > 0
          ? `+${formatTimer(Math.floor(overrun * 60))}`
          : formatTimer(pomodoro.remainingSeconds)}
      </Text>

      {flexible && !focus ? <NextWork session={session} /> : null}

      <XStack gap="$2" flexWrap="wrap" justifyContent="center">
        {flexible && focus && pomodoro.canCutSegment ? (
          <AppButton
            variant="ghost"
            size="$3"
            disabled={pomodoro.isMutating}
            onPress={() => void pomodoro.cutSegment()}
          >
            Cortar tramo
          </AppButton>
        ) : null}
        {flexible ? (
          <AppButton
            variant="ghost"
            size="$3"
            disabled={pomodoro.isMutating}
            onPress={() => void pomodoro.endBlock()}
          >
            Terminar bloque
          </AppButton>
        ) : null}
        {inBlock ? (
          <AppButton variant="ghost" size="$3" onPress={() => focusView.requestExit(key)}>
            Salir
          </AppButton>
        ) : (
          <AppButton
            variant="ghost"
            size="$3"
            disabled={pomodoro.isMutating}
            onPress={() => void pomodoro.cancel()}
          >
            Cancelar pomodoro
          </AppButton>
        )}
      </XStack>

      <YStack width="100%">
        {flexible ? <FlexiblePlan session={session} /> : inBlock ? <SequenceTimeline /> : null}
      </YStack>

      {withTutor ? (
        <XStack gap="$3" flexWrap="wrap" justifyContent="center" paddingTop="$2">
          <SizeControl
            label="Reloj"
            value={layout.timerScale}
            onChange={(timerScale) => setLayout({ timerScale })}
          />
          <SizeControl
            label="Chat"
            value={layout.chatZoom}
            onChange={(chatZoom) => setLayout({ chatZoom })}
          />
        </XStack>
      ) : null}
    </YStack>
  );

  return createPortal(
    <XStack
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={9990}
      backgroundColor="$background"
      padding="$4"
      gap={0}
      flexDirection={stacked ? 'column' : 'row'}
      alignItems="stretch"
      style={{
        overflowY: stacked ? 'auto' : 'hidden',
        overflowX: 'hidden',
        cursor: dragging ? 'col-resize' : undefined,
      }}
    >
      {pomodoroColumn}

      {withTutor && !stacked ? (
        // The divider: drag it to give the chat or the pomodoro more room.
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Ajustar el ancho"
          title="Arrastra para ajustar el ancho"
          onPointerDown={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDoubleClick={() => setLayout({ leftWidth: DEFAULT_LAYOUT.leftWidth })}
          style={{
            width: 14,
            flexShrink: 0,
            cursor: 'col-resize',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: 4,
              height: 64,
              borderRadius: 2,
              background: dragging ? 'rgba(78,224,160,0.9)' : 'rgba(255,255,255,0.18)',
            }}
          />
        </div>
      ) : null}

      {withTutor ? (
        // The chat is what a study pomodoro is for: the rest of the screen, to the bottom edge.
        <YStack
          flex={1}
          minWidth={0}
          minHeight={stacked ? 520 : 0}
          style={{ zoom: layout.chatZoom } as React.CSSProperties}
        >
          <TutorPanel fullHeight />
        </YStack>
      ) : null}
    </XStack>,
    document.body,
  );
}
