import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { ScrollView, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewProps } from 'react-native';
import { registerTutorialScrollView } from '../../lib/onboarding/scrollRegistry';

/**
 * Drop-in replacement for RN's `ScrollView`, used by every screen that has `TutorialTarget`
 * sections -- registers itself (scrollRegistry.ts) so OnboardingTutorial.tsx can scroll the
 * current screen to bring an off-screen step's target into view. Everything else (props, ref
 * forwarding) behaves exactly like a plain ScrollView; screens that don't care about the tour
 * can use this unconditionally with no behavior change.
 */
export const TutorialScrollView = forwardRef<ScrollView, ScrollViewProps>(function TutorialScrollView(
  { onScroll, ...props },
  forwardedRef,
) {
  const innerRef = useRef<ScrollView>(null);
  const offsetYRef = useRef(0);

  useImperativeHandle(forwardedRef, () => innerRef.current as ScrollView);

  useEffect(
    () =>
      registerTutorialScrollView({
        getOffsetY: () => offsetYRef.current,
        scrollToY: (y) => innerRef.current?.scrollTo({ y, animated: true }),
      }),
    [],
  );

  return (
    <ScrollView
      ref={innerRef}
      scrollEventThrottle={16}
      onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
        offsetYRef.current = event.nativeEvent.contentOffset.y;
        onScroll?.(event);
      }}
      {...props}
    />
  );
});
