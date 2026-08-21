import { useEffect, useRef, type ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { registerTutorialTarget, type MeasuredRect } from '../../lib/onboarding/targetRegistry';

interface TutorialTargetProps extends ViewProps {
  id: string;
  children: ReactNode;
}

/**
 * Wraps a section of a screen so OnboardingTutorial.tsx can find and highlight it -- the native
 * equivalent of apps/web's `data-tutorial="..."` DOM attribute, since there's no
 * `document.querySelector` here. `collapsable={false}` is required: without it RN's view-flattening
 * optimization can drop this wrapper from the native tree entirely (it has no styling of its own),
 * which would make `measureInWindow` silently measure nothing.
 */
export function TutorialTarget({ id, children, ...viewProps }: TutorialTargetProps) {
  const ref = useRef<View>(null);

  useEffect(() => {
    return registerTutorialTarget(id, () => {
      return new Promise<MeasuredRect | null>((resolve) => {
        if (!ref.current) {
          resolve(null);
          return;
        }
        ref.current.measureInWindow((x, y, width, height) => {
          resolve(width > 0 || height > 0 ? { x, y, width, height } : null);
        });
      });
    });
  }, [id]);

  return (
    <View ref={ref} collapsable={false} {...viewProps}>
      {children}
    </View>
  );
}
