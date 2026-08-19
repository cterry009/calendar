import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppButton, Paragraph, Text, XStack, YStack } from '@calendar/ui';

interface BreathPhaseDef {
  key: 'inhale' | 'hold' | 'exhale';
  label: string;
  seconds: number;
}

const BREATH_PHASES: BreathPhaseDef[] = [
  { key: 'inhale', label: 'Inhala', seconds: 4 },
  { key: 'hold', label: 'Reten', seconds: 7 },
  { key: 'exhale', label: 'Exhala', seconds: 8 },
];

const CYCLE_SECONDS = BREATH_PHASES.reduce((sum, phase) => sum + phase.seconds, 0);

function phaseAt(elapsedInCycle: number): { phase: BreathPhaseDef; secondsLeft: number } {
  let acc = 0;
  for (const phase of BREATH_PHASES) {
    if (elapsedInCycle < acc + phase.seconds) {
      return { phase, secondsLeft: phase.seconds - (elapsedInCycle - acc) };
    }
    acc += phase.seconds;
  }
  const last = BREATH_PHASES[BREATH_PHASES.length - 1];
  return { phase: last, secondsLeft: 0 };
}

interface FrictionOverlayProps {
  visible: boolean;
  title: string;
  description?: string;
  /** Number of 4-7-8 breathing cycles (19s each) required before the primary action unlocks. */
  cycles?: number;
  onComplete: () => void;
  onCancel: () => void;
  completeLabel?: string;
  cancelLabel?: string;
}

/**
 * A brief guided 4-7-8 breathing pause used as a softer alternative to a hard
 * block: instead of an abrupt confirm dialog, the primary action stays
 * disabled until the user rides out a short timed breathing cycle. Shared by
 * the focus-blocking exit flow (SoftFocusOverlay) and the "breathing" ritual
 * in Serotonin Mode.
 */
export function FrictionOverlay({
  visible,
  title,
  description,
  cycles = 2,
  onComplete,
  onCancel,
  completeLabel = 'Continuar',
  cancelLabel = 'Cancelar',
}: FrictionOverlayProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const totalSeconds = cycles * CYCLE_SECONDS;

  useEffect(() => {
    if (!visible) {
      setElapsedSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsedSeconds((current) => Math.min(current + 1, totalSeconds));
    }, 1000);
    return () => clearInterval(interval);
  }, [visible, totalSeconds]);

  if (!visible || typeof document === 'undefined') {
    return null;
  }

  const isReady = elapsedSeconds >= totalSeconds;
  const cycleIndex = Math.min(Math.floor(elapsedSeconds / CYCLE_SECONDS), cycles - 1);
  const elapsedInCycle = elapsedSeconds - cycleIndex * CYCLE_SECONDS;
  const { phase, secondsLeft } = phaseAt(elapsedInCycle);

  return createPortal(
    <>
      <style>{`
        @keyframes frictionBreathe {
          0% { transform: scale(0.55); }
          21% { transform: scale(1); }
          58% { transform: scale(1); }
          100% { transform: scale(0.55); }
        }
      `}</style>
      <YStack
        position="fixed"
        top={0}
        left={0}
        right={0}
        bottom={0}
        zIndex={10000}
        backgroundColor="rgba(12, 16, 14, 0.96)"
        justifyContent="center"
        alignItems="center"
        padding="$6"
      >
        <YStack width="100%" maxWidth={480} alignItems="center" gap="$5">
          <Text fontWeight="700" textTransform="uppercase" letterSpacing={1} color="$muted">
            {title}
          </Text>

          {description ? (
            <Paragraph margin={0} color="$muted" textAlign="center">
              {description}
            </Paragraph>
          ) : null}

          <div
            style={{
              width: 180,
              height: 180,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 30%, rgba(120,220,180,0.85), rgba(30,110,90,0.55))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: isReady ? 'none' : `frictionBreathe ${CYCLE_SECONDS}s ease-in-out ${cycles}`,
              transform: isReady ? 'scale(0.85)' : undefined,
            }}
          >
            <Text fontSize={20} fontWeight="700">
              {isReady ? 'Listo' : phase.label}
            </Text>
          </div>

          {!isReady ? (
            <Text color="$muted">
              {secondsLeft}s - ciclo {cycleIndex + 1}/{cycles}
            </Text>
          ) : (
            <Text color="$success">Pausa completa.</Text>
          )}

          <XStack gap="$3" marginTop="$2">
            <AppButton variant="ghost" onPress={onCancel}>
              {cancelLabel}
            </AppButton>
            <AppButton variant="primary" onPress={onComplete} disabled={!isReady}>
              {completeLabel}
            </AppButton>
          </XStack>
        </YStack>
      </YStack>
    </>,
    document.body,
  );
}
