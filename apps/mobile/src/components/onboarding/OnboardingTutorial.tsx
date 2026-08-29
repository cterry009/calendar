import { AppButton, AppCard, Text, XStack, YStack, palette } from '@calendar/ui';
import { useEffect, useState } from 'react';
import { Modal, Pressable, useWindowDimensions } from 'react-native';
import Svg, { Mask, Rect } from 'react-native-svg';
import { useOnboarding } from '../../context/OnboardingContext';
import { scrollActiveViewBy } from '../../lib/onboarding/scrollRegistry';
import { measureTutorialTarget, type MeasuredRect } from '../../lib/onboarding/targetRegistry';
import { TOURS } from '../../lib/onboarding/tours';

const FIND_TARGET_TIMEOUT_MS = 700;
const FIND_TARGET_INTERVAL_MS = 60;
const SPOTLIGHT_PADDING = 8;
const SPOTLIGHT_RADIUS = 14;
const TOOLTIP_GAP = 16;
const TOOLTIP_MARGIN = 16;

// How long to wait for TutorialScrollView's `scrollTo({ animated: true })` to settle before
// re-measuring -- shorter than the animation itself (RN's default is ~300-500ms) would re-measure
// mid-scroll and land on a stale rect; this errs long since one extra frame of delay is invisible
// but a wrong rect isn't.
const SCROLL_SETTLE_MS = 400;
// A target is left alone if it already falls within this band -- top: clears the screen header,
// bottom: leaves room for the tooltip card that anchors below/above the spotlight either way.
const SAFE_ZONE_TOP = 140;
const SAFE_ZONE_BOTTOM_MARGIN = 260;

/**
 * Native port of apps/web's OnboardingTutorial.tsx spotlight engine. Same idea (dim everything
 * except a highlighted cutout around the current step's target, with an anchored tooltip) but a
 * different mechanism throughout: no DOM, so no `data-tutorial` attribute/querySelector/
 * getBoundingClientRect/box-shadow-spread cutout trick/createPortal. Targets register themselves
 * via TutorialTarget.tsx into targetRegistry.ts instead, measured with `measureInWindow`; the
 * cutout is a real one (not just a bordered rectangle over a uniform dim layer) via an
 * `react-native-svg` mask, already a direct dependency of this app; and top-level rendering
 * (escaping wherever OnboardingProvider happens to sit in the tree) comes from RN's own `Modal`
 * rather than a DOM portal.
 *
 * Ports web's `element.scrollIntoView()` too, via a small registry (scrollRegistry.ts) instead of
 * the DOM API: TutorialScrollView.tsx (a drop-in ScrollView replacement every screen with
 * TutorialTarget sections now uses) registers itself, and the measurement effect below scrolls
 * the current screen to bring an off-screen step's target into the visible "safe zone" before
 * settling on a rect. A real bug found testing on-device is what made this necessary, not just a
 * nice-to-have: the Modal below renders a full-screen `Pressable` that intercepts touch/scroll
 * gestures on the underlying screen, so a user couldn't manually scroll to a highlighted-but-
 * off-screen element either -- the spotlight would light something up out of view with no way to
 * see it short of closing the tour.
 */
function isWithinSafeZone(rect: MeasuredRect, windowHeight: number): boolean {
  return rect.y >= SAFE_ZONE_TOP && rect.y + rect.height <= windowHeight - SAFE_ZONE_BOTTOM_MARGIN;
}

// How far (and which direction) to scroll so the target's vertical center lands in the middle of
// the safe zone -- centering rather than just nudging it in means a step immediately below
// another one doesn't need a second scroll+re-measure round trip to also clear the bottom margin.
function scrollDeltaFor(rect: MeasuredRect, windowHeight: number): number {
  const safeZoneCenter = SAFE_ZONE_TOP + (windowHeight - SAFE_ZONE_BOTTOM_MARGIN - SAFE_ZONE_TOP) / 2;
  const targetCenter = rect.y + rect.height / 2;
  return targetCenter - safeZoneCenter;
}

export function OnboardingTutorial() {
  const { activeTourId, stepIndex, nextStep, prevStep, closeTour } = useOnboarding();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [rect, setRect] = useState<MeasuredRect | null>(null);

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
    // Only ever try scrolling once per step -- if the target is still outside the safe zone
    // after that (e.g. it's taller than the available band, or the ScrollView is already
    // clamped at its content end), settle for the rect as measured rather than scrolling back
    // and forth forever chasing a safe zone it can't reach.
    let hasScrolled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function attempt() {
      if (cancelled || !step) return;
      const found = await measureTutorialTarget(step.target);
      if (cancelled) return;

      if (found) {
        if (!hasScrolled && !isWithinSafeZone(found, windowHeight) && scrollActiveViewBy(scrollDeltaFor(found, windowHeight))) {
          hasScrolled = true;
          timeoutId = setTimeout(() => void attempt(), SCROLL_SETTLE_MS);
          return;
        }
        setRect(found);
        return;
      }

      elapsed += FIND_TARGET_INTERVAL_MS;
      if (elapsed >= FIND_TARGET_TIMEOUT_MS) {
        // Target never registered (e.g. a conditional card that isn't rendered right now) --
        // skip it instead of leaving the tour stuck on an invisible step.
        nextStep();
        return;
      }
      timeoutId = setTimeout(() => void attempt(), FIND_TARGET_INTERVAL_MS);
    }

    timeoutId = setTimeout(() => void attempt(), 0);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
    // nextStep intentionally omitted from deps: it changes identity with stepIndex, which would
    // restart this effect on every successful step change (the effect's own setRect(null)+
    // re-measure already runs from the `step` dependency).
  }, [step, windowHeight]);

  if (!tour || !step || !rect) {
    return null;
  }

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === tour.steps.length - 1;

  const spotlight = {
    x: rect.x - SPOTLIGHT_PADDING,
    y: rect.y - SPOTLIGHT_PADDING,
    width: rect.width + SPOTLIGHT_PADDING * 2,
    height: rect.height + SPOTLIGHT_PADDING * 2,
  };

  const roomBelow = windowHeight - (spotlight.y + spotlight.height);
  const showBelow = roomBelow > 220 || spotlight.y < 220;
  const tooltipTop = showBelow ? Math.min(spotlight.y + spotlight.height + TOOLTIP_GAP, windowHeight - 24) : undefined;
  const tooltipBottom = showBelow ? undefined : windowHeight - spotlight.y + TOOLTIP_GAP;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={closeTour} statusBarTranslucent>
      <Pressable
        onPress={closeTour}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        accessibilityLabel="Cerrar recorrido"
      />

      <Svg width={windowWidth} height={windowHeight} style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
        <Mask id="spotlight-mask">
          <Rect x={0} y={0} width={windowWidth} height={windowHeight} fill="white" />
          <Rect
            x={spotlight.x}
            y={spotlight.y}
            width={spotlight.width}
            height={spotlight.height}
            rx={SPOTLIGHT_RADIUS}
            ry={SPOTLIGHT_RADIUS}
            fill="black"
          />
        </Mask>
        <Rect x={0} y={0} width={windowWidth} height={windowHeight} fill="rgba(6, 12, 10, 0.8)" mask="url(#spotlight-mask)" />
        <Rect
          x={spotlight.x}
          y={spotlight.y}
          width={spotlight.width}
          height={spotlight.height}
          rx={SPOTLIGHT_RADIUS}
          ry={SPOTLIGHT_RADIUS}
          fill="none"
          stroke={palette.accent}
          strokeWidth={2}
        />
      </Svg>

      <AppCard position="absolute" top={tooltipTop} bottom={tooltipBottom} left={TOOLTIP_MARGIN} right={TOOLTIP_MARGIN}>
        <YStack gap="$3">
          <XStack justifyContent="space-between" alignItems="center">
            <Text color="$muted" fontSize="$1" textTransform="uppercase" letterSpacing={1}>
              Paso {stepIndex + 1} de {tour.steps.length}
            </Text>
            <AppButton variant="ghost" paddingHorizontal="$2" onPress={closeTour}>
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
    </Modal>
  );
}
