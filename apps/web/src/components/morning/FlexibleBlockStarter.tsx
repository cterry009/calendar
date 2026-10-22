import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BLOCK_MIN_MAX,
  BLOCK_MIN_MIN,
  BLOCK_MIN_STEP,
  CHECK_IN_SCALE,
  FOCUS_MIN_MAX,
  FOCUS_MIN_MIN,
  FOCUS_MIN_STEP,
  checkInProposal,
  clampBlockMin,
  clampFocusMin,
  planFlexibleBlock,
  plannedFocusMinutes,
} from '@calendar/shared';
import { AppButton, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { usePomodoro } from '../../context/PomodoroContext';
import { useMorningWindow } from '../../hooks/useMorningWindow';
import { focusView, useFocusViewState } from '../../lib/focusView/store';

// Starting a flexible morning block (dynamic-study-blocks D7, D16): motivation and concentration in
// one tap each propose the block's length and its focus length from the shared table; both can be
// moved before starting. Starting runs the first focus right away.

const SCALE_LABELS: Record<number, string> = {
  1: 'Muy baja',
  2: 'Baja',
  3: 'Media',
  4: 'Alta',
  5: 'Muy alta',
};

function Stepper({
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

function ScaleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <YStack gap="$1">
      <Text fontWeight="700">{label}</Text>
      <XStack gap="$2" flexWrap="wrap">
        {CHECK_IN_SCALE.map((n) => (
          <AppButton
            key={n}
            variant={value === n ? 'primary' : 'ghost'}
            onPress={() => onChange(n)}
          >
            {`${n} · ${SCALE_LABELS[n]}`}
          </AppButton>
        ))}
      </XStack>
    </YStack>
  );
}

/** The "Empezar bloque N" button; opens the check-in. Hidden on days without a morning window. */
export function StartFlexibleBlockButton({ compact = false }: { compact?: boolean }) {
  const morning = useMorningWindow();
  const { session } = usePomodoro();
  if (!morning.schedule || session?.active) return null;
  const label = morning.afterWindow
    ? `Empezar bloque ${morning.nextNumber} (fuera de la ventana)`
    : `Empezar bloque ${morning.nextNumber}`;
  return (
    <AppButton variant={compact ? 'ghost' : 'primary'} onPress={focusView.openStarter}>
      {label}
    </AppButton>
  );
}

/** The check-in card, mounted once in the layout and opened from anywhere. */
export function FlexibleBlockStarter() {
  const { starterOpen } = useFocusViewState();
  const morning = useMorningWindow();
  const { startFlexibleBlock, session, isMutating } = usePomodoro();
  const [motivation, setMotivation] = useState<number | null>(null);
  const [concentration, setConcentration] = useState<number | null>(null);
  const [blockMin, setBlockMin] = useState(120);
  const [focusMin, setFocusMin] = useState(30);
  const [error, setError] = useState<string | null>(null);

  // A fresh check-in every time it opens.
  useEffect(() => {
    if (!starterOpen) return;
    setMotivation(null);
    setConcentration(null);
    setError(null);
  }, [starterOpen]);

  // The table proposes; the user's − / + after that win until the values change again.
  useEffect(() => {
    if (motivation === null || concentration === null) return;
    const proposal = checkInProposal(motivation, concentration);
    setBlockMin(proposal.blockMin);
    setFocusMin(proposal.focusMin);
  }, [motivation, concentration]);

  // Nothing to start (no window today, or a pomodoro is already running): close.
  const unavailable = !morning.schedule || !!session?.active;
  useEffect(() => {
    if (starterOpen && unavailable) focusView.closeStarter();
  }, [starterOpen, unavailable]);

  if (!starterOpen || unavailable || typeof document === 'undefined') return null;

  const answered = motivation !== null && concentration !== null;
  const proposal = answered ? checkInProposal(motivation, concentration) : null;
  const plan = planFlexibleBlock(blockMin, focusMin);
  const focusCount = plan.filter((s) => s.tipo === 'foco').length;

  async function start() {
    if (!proposal || !morning.schedule) return;
    setError(null);
    try {
      const id = await startFlexibleBlock({
        scheduleId: morning.schedule.id,
        windowEndAt: morning.afterWindow ? null : morning.end,
        blockMin,
        focusMin,
        taskId: morning.studyTask?.id ?? null,
        checkIn: {
          motivation: motivation!,
          concentration: concentration!,
          energy: proposal.energy,
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
          {morning.schedule?.label ?? 'Estudio'} · bloque {morning.nextNumber}
        </Text>
        <Text fontSize="$7" fontWeight="800">
          ¿Cómo llegas a este bloque?
        </Text>
        {morning.studyTask ? (
          <Paragraph margin={0} color="$muted">
            Sesión: {morning.studyTask.title}
          </Paragraph>
        ) : null}
        <ScaleRow label="Motivación" value={motivation} onChange={setMotivation} />
        <ScaleRow label="Concentración" value={concentration} onChange={setConcentration} />
        {proposal ? (
          <YStack gap="$2" paddingTop="$2">
            <Text fontWeight="700">
              Energía {proposal.energy}: propuesta de {proposal.blockMin} min con focos de{' '}
              {proposal.focusMin}
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
              label="Focos de"
              value={focusMin}
              min={FOCUS_MIN_MIN}
              max={FOCUS_MIN_MAX}
              step={FOCUS_MIN_STEP}
              unit="min"
              onChange={(v) => setFocusMin(clampFocusMin(v))}
            />
            <Paragraph margin={0} color="$muted" fontSize="$2">
              {focusCount} focos ({plannedFocusMinutes(plan)} min de foco) con sus pausas y el
              cierre de 15 min. La pausa arranca sola; cada foco lo empiezas tú.
              {morning.afterWindow
                ? ' Ya pasaron las 12:00: este bloque no tiene límite de hora.'
                : ' A las 12:00 no empieza ningún foco nuevo: el que corra termina y sigue el cierre.'}
            </Paragraph>
          </YStack>
        ) : (
          <Paragraph margin={0} color="$muted" fontSize="$2">
            Con las dos respuestas la app propone la duración del bloque y de los focos.
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
