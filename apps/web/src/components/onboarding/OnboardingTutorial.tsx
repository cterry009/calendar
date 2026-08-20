import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppButton, AppCard, Text, XStack, YStack, palette, paletteLight } from '@calendar/ui';
import { useAppearance } from '../../context/AppearanceContext';
import { useOnboarding } from '../../context/OnboardingContext';
import { TOURS } from '../../lib/onboarding/tours';

const FIND_TARGET_TIMEOUT_MS = 700;
const FIND_TARGET_INTERVAL_MS = 60;
const SPOTLIGHT_PADDING = 8;
const TOOLTIP_WIDTH = 360;
const TOOLTIP_GAP = 16;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function measureTarget(target: string): Rect | null {
  const element = document.querySelector(`[data-tutorial="${target}"]`);
  if (!element) return null;
  const domRect = element.getBoundingClientRect();
  if (domRect.width === 0 && domRect.height === 0) return null;
  return { top: domRect.top, left: domRect.left, width: domRect.width, height: domRect.height };
}

/**
 * Spotlight-style tour engine: dims the whole screen except a highlighted cutout around
 * whatever element carries the matching `data-tutorial` attribute, with a tooltip anchored
 * next to it. Driven entirely by OnboardingContext's activeTourId/stepIndex -- this component
 * has no opinion on which panel needs to be open, that's decided by whoever calls startTour().
 */
export function OnboardingTutorial() {
  const { activeTourId, stepIndex, nextStep, prevStep, closeTour } = useOnboarding();
  const { mode } = useAppearance();
  const accentColor = mode === 'light' ? paletteLight.accent : palette.accent;
  const [rect, setRect] = useState<Rect | null>(null);

  const tour = activeTourId ? TOURS[activeTourId] : null;
  const step = tour ? tour.steps[stepIndex] : null;

  useEffect(() => {
    if (!step) {
      setRect(null);
      return;
    }

    setRect(null);
    let cancelled = false;
    let elapsed = 0;
    let timeoutId: number;

    function attempt() {
      if (cancelled) return;
      const element = document.querySelector(`[data-tutorial="${step!.target}"]`);
      if (element) {
        // The target may be below the fold (e.g. the sidebar wraps under the calendar on
        // narrower widths) -- scroll it into view before measuring so the spotlight lands
        // somewhere the user can actually see, instead of clamping off-screen.
        element.scrollIntoView({ block: 'center', behavior: 'auto' });
        requestAnimationFrame(() => {
          if (cancelled) return;
          const found = measureTarget(step!.target);
          if (found) setRect(found);
        });
        return;
      }
      elapsed += FIND_TARGET_INTERVAL_MS;
      if (elapsed >= FIND_TARGET_TIMEOUT_MS) {
        // Target never showed up (e.g. a day-only block while in week view) -- skip it
        // instead of leaving the tour stuck on an invisible step.
        nextStep();
        return;
      }
      timeoutId = window.setTimeout(attempt, FIND_TARGET_INTERVAL_MS);
    }

    timeoutId = window.setTimeout(attempt, 0);

    function reposition() {
      const found = measureTarget(step!.target);
      if (found) setRect(found);
    }

    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [step, nextStep]);

  useEffect(() => {
    if (!activeTourId) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeTour();
      if (event.key === 'ArrowRight') nextStep();
      if (event.key === 'ArrowLeft') prevStep();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTourId, closeTour, nextStep, prevStep]);

  if (!tour || !step || !rect || typeof document === 'undefined') {
    return null;
  }

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === tour.steps.length - 1;

  const spotlight = {
    top: rect.top - SPOTLIGHT_PADDING,
    left: rect.left - SPOTLIGHT_PADDING,
    width: rect.width + SPOTLIGHT_PADDING * 2,
    height: rect.height + SPOTLIGHT_PADDING * 2,
  };

  const roomBelow = window.innerHeight - (spotlight.top + spotlight.height);
  const showBelow = roomBelow > 200 || spotlight.top < 200;
  const tooltipTop = showBelow
    ? Math.min(spotlight.top + spotlight.height + TOOLTIP_GAP, window.innerHeight - 24)
    : undefined;
  const tooltipBottom = showBelow ? undefined : window.innerHeight - spotlight.top + TOOLTIP_GAP;
  const tooltipLeft = Math.min(Math.max(16, spotlight.left), Math.max(16, window.innerWidth - TOOLTIP_WIDTH - 16));

  return createPortal(
    <>
      <div
        role="presentation"
        onClick={closeTour}
        style={{ position: 'fixed', inset: 0, zIndex: 1000, cursor: 'pointer' }}
      />
      <div
        style={{
          position: 'fixed',
          top: spotlight.top,
          left: spotlight.left,
          width: spotlight.width,
          height: spotlight.height,
          borderRadius: 14,
          border: `2px solid ${accentColor}`,
          boxShadow: '0 0 0 9999px rgba(6, 12, 10, 0.75)',
          pointerEvents: 'none',
          zIndex: 1001,
          transition: 'top 200ms ease, left 200ms ease, width 200ms ease, height 200ms ease',
        }}
      />

      <AppCard
        position="fixed"
        top={tooltipTop}
        bottom={tooltipBottom}
        left={tooltipLeft}
        width={`min(${TOOLTIP_WIDTH}px, 92vw)`}
        zIndex={1002}
      >
        <YStack gap="$3">
          <XStack justifyContent="space-between" alignItems="center">
            <Text color="$muted" fontSize="$1" textTransform="uppercase" letterSpacing={1}>
              Paso {stepIndex + 1} de {tour.steps.length}
            </Text>
            <AppButton variant="ghost" paddingHorizontal="$2" onPress={closeTour} aria-label="Cerrar recorrido">
              Cerrar
            </AppButton>
          </XStack>

          <YStack gap="$1">
            <Text fontWeight="700" fontSize="$5">
              {step.title}
            </Text>
            <Text color="$muted" fontSize="$3">
              {step.description}
            </Text>
          </YStack>

          <XStack justifyContent="space-between" alignItems="center" gap="$2">
            <AppButton variant="ghost" onPress={prevStep} disabled={isFirst}>
              Anterior
            </AppButton>
            <AppButton variant="primary" onPress={nextStep}>
              {isLast ? 'Finalizar' : 'Siguiente'}
            </AppButton>
          </XStack>
        </YStack>
      </AppCard>
    </>,
    document.body,
  );
}
