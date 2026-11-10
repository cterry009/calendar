import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BLOCK_DONE_FOCUS_MIN,
  BLOCK_MIN_MAX,
  BLOCK_MIN_MIN,
  BLOCK_MIN_STEP,
  FOCUS_MIN_MAX,
  FOCUS_MIN_MIN,
  FOCUS_MIN_STEP,
  adjustPlannedBlock,
  clampBlockMin,
  clampFocusMin,
  currentSegment,
  diagnosisBand,
  elapsedBlockMinutes,
  flexibleSegments,
  focusMinFor,
  lastFocusWasCut,
  nextFlexibleWork,
  pauseOverrunMinutes,
  studySessionLine,
} from '@calendar/shared';
import { AppButton, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { usePomodoro } from '../../context/PomodoroContext';
import { useDayBlocks } from '../../hooks/useMorningWindow';
import { useSchedules } from '../../hooks/useSchedules';
import { useTasks } from '../../hooks/useTasks';
import { focusView, phaseKey, useFocusViewState } from '../../lib/focusView/store';
import { formatTimer } from '../../lib/pomodoro/timer';
import { studySectionsOf } from '../../lib/studyGame/studySections';
import type { SyncPomodoroRecord } from '../../lib/pomodoro/types';
import { SequenceTimeline } from '../pomodoro/SequenceTimeline';
import { DiagnosisSliders } from '../morning/Diagnosis';
import { Stepper } from '../morning/FlexibleBlockStarter';
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

/** The block as a budget (D25): planned, gone by and left, and the segments so far. */
function FlexiblePlan({ session }: { session: SyncPomodoroRecord }) {
  const segments = flexibleSegments(session);
  const running = session.segmentIndex ?? -1;
  const focus = session.focusMinutes ?? 0;
  const planned = session.plannedBlockMin ?? null;
  const elapsed = Math.round(elapsedBlockMinutes(session));
  return (
    <YStack gap="$1" width="100%">
      {planned ? (
        <Text fontSize="$2" color="$muted">
          Bloque planeado: {planned} min · llevas {elapsed} · quedan{' '}
          {Math.max(0, planned - elapsed)}
        </Text>
      ) : null}
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
      </Text>
    </YStack>
  );
}

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * The pause screen (D22-D26): the next focus's diagnosis (0-100), the ±10 rule on the planned block
 * with the last rating, and the proposal -- the band's focus, or less if only that fits -- which the
 * user can move before starting it; or the closing once no focus fits or the window closed.
 */
function NextWork({ session }: { session: SyncPomodoroRecord }) {
  const { startFocus, endBlock, isMutating } = usePomodoro();
  const { lastRating, lastDiagnosis } = useFocusViewState();
  const day = useDayBlocks();
  const key = phaseKey(session);
  const [motivation, setMotivation] = useState<number | null>(lastDiagnosis?.motivation ?? null);
  const [concentration, setConcentration] = useState<number | null>(
    lastDiagnosis?.concentration ?? null,
  );
  const [touched, setTouched] = useState(false);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [planned, setPlanned] = useState<number | null>(null);

  // A new pause: a new diagnosis (starting from the last one) and a fresh proposal.
  useEffect(() => {
    setMotivation(lastDiagnosis?.motivation ?? null);
    setConcentration(lastDiagnosis?.concentration ?? null);
    setTouched(false);
    setMinutes(null);
    setPlanned(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const answered = motivation !== null && concentration !== null;
  const band = answered ? diagnosisBand(motivation, concentration) : null;
  const rating =
    lastRating?.sessionId === session.id && lastRating.cycle === session.completedCycles
      ? lastRating.rating
      : null;
  const plannedBefore = session.plannedBlockMin ?? BLOCK_MIN_MAX;
  const rule = band
    ? adjustPlannedBlock({
        planned: plannedBefore,
        lastRating: rating,
        band,
        lastCut: lastFocusWasCut(session),
        workedMin: elapsedBlockMinutes(session),
      })
    : null;
  const plannedNow = planned ?? rule?.planned ?? plannedBefore;
  const next = nextFlexibleWork(session, Date.now(), plannedNow);
  const proposedFocus =
    band && next?.tipo === 'foco' ? Math.min(focusMinFor(band), next.minutes) : null;
  const focusNow = minutes ?? proposedFocus ?? 30;
  const labels = day.suggestions.find((s) => s.schedule.id === session.scheduleId)?.focusLabels;

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
        <Paragraph margin={0} color="$muted" textAlign="center">
          {next.closingOnly && session.windowEndAt
            ? `Ya son más de las ${hhmm(session.windowEndAt)}: no empieza otro foco, sigue el cierre.`
            : 'Otro foco ya no cabe en el bloque planeado: sigue el cierre.'}
        </Paragraph>
        <AppButton
          variant="primary"
          disabled={isMutating}
          onPress={() => void startFocus({ closing: true })}
        >
          Empezar cierre ({next.minutes} min)
        </AppButton>
      </YStack>
    );
  }

  async function start() {
    if (!band || !rule) return;
    focusView.setLastDiagnosis(motivation!, concentration!);
    await startFocus({
      minutes: focusNow,
      plannedBlockMin: plannedNow,
      label: labels?.[next!.focusesDone] ?? undefined,
      diagnosis: {
        motivation: motivation!,
        concentration: concentration!,
        band,
        proposedFocusMin: proposedFocus ?? focusNow,
        plannedBefore,
        rule: rule.reason,
      },
    });
  }

  return (
    <YStack gap="$3" alignItems="stretch" width="100%" maxWidth={420}>
      <Text fontWeight="800" textAlign="center">
        ¿Cómo llegas al foco {next.focusesDone + 1}?
      </Text>
      <DiagnosisSliders
        motivation={motivation}
        concentration={concentration}
        onChange={(v) => {
          setMotivation(v.motivation);
          setConcentration(v.concentration);
          setTouched(true);
          setMinutes(null);
          setPlanned(null);
        }}
      />
      {band && rule ? (
        <YStack gap="$2">
          <Text fontSize="$2" color="$muted">
            {rule.reason}
            {rating === null
              ? ' (sin calificación del pomodoro anterior)'
              : ` · último pomodoro ${rating}/100`}
          </Text>
          <Stepper
            label="Bloque"
            value={plannedNow}
            min={BLOCK_MIN_MIN}
            max={BLOCK_MIN_MAX}
            step={BLOCK_MIN_STEP}
            unit="min"
            onChange={(v) => setPlanned(clampBlockMin(v))}
          />
          <Stepper
            label="Este foco"
            value={focusNow}
            min={FOCUS_MIN_MIN}
            max={FOCUS_MIN_MAX}
            step={FOCUS_MIN_STEP}
            unit="min"
            onChange={(v) => setMinutes(clampFocusMin(v))}
          />
          <AppButton
            variant="primary"
            disabled={isMutating || !touched}
            onPress={() => void start()}
          >
            {`Empezar foco de ${focusNow} min`}
          </AppButton>
          {!touched ? (
            <Text fontSize="$1" color="$muted" textAlign="center">
              Mueve los deslizadores (aunque sea para confirmar) para empezar.
            </Text>
          ) : null}
        </YStack>
      ) : (
        <Text fontSize="$2" color="$muted" textAlign="center">
          Da tu diagnóstico para ver el siguiente foco.
        </Text>
      )}
    </YStack>
  );
}

// The layout is the user's to adjust (2026-10-22): the pomodoro is a narrow column on the left and the
// tutor's chat takes the rest of the screen, edge to edge; the divider between them drags, and the
// timer and the chat each have their own size (A− / A+). Kept per device in localStorage.
const LAYOUT_KEY = 'calendar:focus-view-layout';
const MIN_LEFT = 220;
// timeMode (2026-11-10, agenda-redesign 3.1): the clock, a progress bar in its place, or nothing.
// Only the display changes: timing, records and notices run as before.
type TimeMode = 'reloj' | 'barra' | 'oculto';
const DEFAULT_LAYOUT: { leftWidth: number; timerScale: number; chatZoom: number; timeMode: TimeMode } = {
  leftWidth: 320,
  timerScale: 1,
  chatZoom: 1,
  timeMode: 'reloj',
};
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
  const phaseTotal = (pomodoro.phaseDurationMinutes ?? 0) * 60;
  const phaseShare =
    overrun > 0 ? 100 : phaseTotal > 0 ? Math.round(Math.max(0, Math.min(1, 1 - pomodoro.remainingSeconds / phaseTotal)) * 100) : 0;
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
      {layout.timeMode === 'reloj' ? (
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
      ) : layout.timeMode === 'barra' ? (
        <YStack width="100%" gap="$1" paddingVertical="$2" aria-label="Avance del tramo">
          <YStack height={14} borderRadius={7} backgroundColor="$borderColor" overflow="hidden">
            <YStack
              height="100%"
              width={`${phaseShare}%`}
              backgroundColor={overrun > 0 ? '$warning' : focus ? '$accent' : '$muted'}
            />
          </YStack>
        </YStack>
      ) : null}
      <XStack gap="$1" justifyContent="center" role="group" aria-label="Cómo ver el tiempo">
        {(
          [
            ['reloj', 'Reloj'],
            ['barra', 'Barra'],
            ['oculto', 'Ocultar'],
          ] as const
        ).map(([mode, label]) => (
          <AppButton
            key={mode}
            size="$2"
            variant={layout.timeMode === mode ? 'primary' : 'ghost'}
            aria-pressed={layout.timeMode === mode}
            onPress={() => setLayout({ timeMode: mode })}
          >
            {label}
          </AppButton>
        ))}
      </XStack>

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
