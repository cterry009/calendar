import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BAND_LABELS,
  BLOCK_MIN_MAX,
  BLOCK_MIN_MIN,
  BLOCK_MIN_STEP,
  FOCUS_MIN_MAX,
  FOCUS_MIN_MIN,
  FOCUS_MIN_STEP,
  clampBlockMin,
  clampFocusMin,
  diagnosisProposal,
} from '@calendar/shared';
import { AppButton, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { usePomodoro } from '../../context/PomodoroContext';
import { useDayBlocks, type DaySuggestion } from '../../hooks/useMorningWindow';
import { focusView, useFocusViewState } from '../../lib/focusView/store';
import { DiagnosisSliders } from './Diagnosis';

// Starting a flexible block (dynamic-study-blocks revision 2, D22-D23): the first diagnosis
// (motivation and concentration, 0-100) proposes the block's length (60/90/120) and the first focus's
// (20/30/40); both can be moved before starting. Starting runs the first focus right away.

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function Stepper({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <XStack gap="$2" alignItems="center">
      <Text width={150}>{label}</Text>
      <AppButton variant="ghost" disabled={value <= min} onPress={() => onChange(value - step)}>
        −
      </AppButton>
      <Text
        fontWeight="800"
        width={70}
        textAlign="center"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value} {unit}
      </Text>
      <AppButton variant="ghost" disabled={value >= max} onPress={() => onChange(value + step)}>
        +
      </AppButton>
    </XStack>
  );
}

/** "Empezar" for a suggested block (or the next one due); hidden without one or while a pomodoro runs. */
export function StartFlexibleBlockButton({
  scheduleId,
  compact = false,
}: {
  scheduleId?: string;
  compact?: boolean;
}) {
  const day = useDayBlocks();
  const { session } = usePomodoro();
  const target = scheduleId ? day.suggestions.find((s) => s.schedule.id === scheduleId) : day.next;
  if (!target || session?.active) return null;
  const late = !!target.windowEnd && new Date() >= target.windowEnd;
  return (
    <AppButton
      variant={compact ? 'ghost' : 'primary'}
      onPress={() => focusView.openStarter(target.schedule.id)}
    >
      {`Empezar ${target.schedule.label ?? 'bloque'} (${hhmm(target.start)})${late ? ' · fuera de la ventana' : ''}`}
    </AppButton>
  );
}

/** The diagnosis card, mounted once in the layout and opened from anywhere. */
export function FlexibleBlockStarter() {
  const { starterOpen, starterScheduleId, lastDiagnosis } = useFocusViewState();
  const day = useDayBlocks();
  const { startFlexibleBlock, session, isMutating } = usePomodoro();
  const [motivation, setMotivation] = useState<number | null>(null);
  const [concentration, setConcentration] = useState<number | null>(null);
  const [blockMin, setBlockMin] = useState(90);
  const [focusMin, setFocusMin] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const target: DaySuggestion | null =
    (starterScheduleId
      ? day.suggestions.find((s) => s.schedule.id === starterScheduleId)
      : day.next) ?? null;

  // Each time it opens: the day's last diagnosis as the starting point (or nothing).
  useEffect(() => {
    if (!starterOpen) return;
    setMotivation(lastDiagnosis?.motivation ?? null);
    setConcentration(lastDiagnosis?.concentration ?? null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [starterOpen]);

  // The rule proposes; the user's − / + after that win until the diagnosis changes again.
  useEffect(() => {
    if (motivation === null || concentration === null) return;
    const proposal = diagnosisProposal(motivation, concentration);
    setBlockMin(proposal.blockMin);
    setFocusMin(proposal.focusMin);
  }, [motivation, concentration]);

  // Nothing to start (no suggestion today, or a pomodoro is already running): close.
  const unavailable = !target || !!session?.active;
  useEffect(() => {
    if (starterOpen && unavailable) focusView.closeStarter();
  }, [starterOpen, unavailable]);

  if (!starterOpen || unavailable || !target || typeof document === 'undefined') return null;

  const answered = motivation !== null && concentration !== null;
  const proposal = answered ? diagnosisProposal(motivation, concentration) : null;
  const afterWindow = !!target.windowEnd && new Date() >= target.windowEnd;

  async function start() {
    if (!proposal || !target) return;
    setError(null);
    try {
      focusView.setLastDiagnosis(motivation!, concentration!);
      const id = await startFlexibleBlock({
        scheduleId: target.schedule.id,
        windowEndAt: afterWindow ? null : target.windowEnd,
        blockMin,
        focusMin,
        taskId: target.studyTask?.id ?? null,
        label: target.focusLabels?.[0],
        checkIn: {
          motivation: motivation!,
          concentration: concentration!,
          band: proposal.band,
          proposed: { blockMin: proposal.blockMin, focusMin: proposal.focusMin },
        },
      });
      if (!id) {
        setError('No se pudo empezar: ya hay un pomodoro corriendo.');
        return;
      }
      focusView.expand();
      focusView.closeStarter();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo empezar el bloque.');
    }
  }

  return createPortal(
    <YStack
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={9997}
      backgroundColor="rgba(18, 21, 27, 0.9)"
      justifyContent="center"
      alignItems="center"
      padding="$4"
    >
      <YStack
        width="100%"
        maxWidth={620}
        gap="$3"
        padding="$5"
        borderRadius="$8"
        borderWidth={2}
        borderColor="$accent"
        backgroundColor="$background"
        maxHeight="100%"
        style={{ overflowY: 'auto', overflowX: 'hidden' }}
      >
        <Text color="$accent" fontWeight="700" textTransform="uppercase" letterSpacing={1}>
          {target.schedule.label ?? 'Bloque'} · sugerido a las {hhmm(target.start)}
        </Text>
        <Text fontSize="$7" fontWeight="800">
          ¿Cómo llegas a este bloque?
        </Text>
        {target.studyTask ? (
          <Paragraph margin={0} color="$muted">
            Sesión: {target.studyTask.title}
          </Paragraph>
        ) : null}
        <DiagnosisSliders
          motivation={motivation}
          concentration={concentration}
          onChange={(next) => {
            setMotivation(next.motivation);
            setConcentration(next.concentration);
          }}
        />
        {proposal ? (
          <YStack gap="$2" paddingTop="$2">
            <Text fontWeight="700">
              Energía {BAND_LABELS[proposal.band].toLowerCase()}: propuesta de {proposal.blockMin}{' '}
              min con un primer foco de {proposal.focusMin}
            </Text>
            <Stepper
              label="Duración del bloque"
              value={blockMin}
              min={BLOCK_MIN_MIN}
              max={BLOCK_MIN_MAX}
              step={BLOCK_MIN_STEP}
              unit="min"
              onChange={(v) => setBlockMin(clampBlockMin(v))}
            />
            <Stepper
              label="Primer foco"
              value={focusMin}
              min={FOCUS_MIN_MIN}
              max={FOCUS_MIN_MAX}
              step={FOCUS_MIN_STEP}
              unit="min"
              onChange={(v) => setFocusMin(clampFocusMin(v))}
            />
            <Paragraph margin={0} color="$muted" fontSize="$2">
              Antes de cada foco vuelves a dar el diagnóstico: el foco sale de él y el bloque se
              ajusta ±10 min con la calificación del pomodoro anterior. La pausa arranca sola; cada
              foco lo empiezas tú. Se cumple con 45 min de foco.
              {afterWindow
                ? ' Ya cerró la ventana de este bloque: no tiene límite de hora.'
                : ` A las ${hhmm(target.windowEnd!)} no empieza ningún foco nuevo: el que corra termina y sigue el cierre.`}
            </Paragraph>
          </YStack>
        ) : (
          <Paragraph margin={0} color="$muted" fontSize="$2">
            Mueve los dos deslizadores: con ellos la app propone la duración del bloque y del primer
            foco.
          </Paragraph>
        )}
        {error ? <Text color="$error">{error}</Text> : null}
        <XStack gap="$3" justifyContent="flex-end" marginTop="$2">
          <AppButton variant="ghost" onPress={focusView.closeStarter}>
            Ahora no
          </AppButton>
          <AppButton
            variant="primary"
            disabled={!proposal || isMutating}
            onPress={() => void start()}
          >
            Empezar
          </AppButton>
        </XStack>
      </YStack>
    </YStack>,
    document.body,
  );
}
