// Mirrors targetRegistry.ts's "plain module-scoped registry, not React state" reasoning -- but
// for the current screen's scrollable container instead of individual highlightable elements.
// OnboardingTutorial.tsx needs this to bring an off-screen step's target into view (a real bug
// found testing on-device: the tutorial's full-screen Modal overlay intercepts touch/scroll
// gestures on the underlying screen, so a user can't manually scroll to a highlighted-but-off-
// screen element either -- auto-scrolling the target into view is the fix, not making the
// overlay pass touches through).
//
// Only one screen is ever visible/mounted at a time, so a single "active" slot is enough -- no
// need to key this by screen or route the way targetRegistry keys by target id.
export interface TutorialScrollHandle {
  getOffsetY: () => number;
  scrollToY: (y: number) => void;
}

let active: TutorialScrollHandle | null = null;

export function registerTutorialScrollView(handle: TutorialScrollHandle): () => void {
  active = handle;
  return () => {
    if (active === handle) {
      active = null;
    }
  };
}

// Scrolls the currently-registered screen's ScrollView so its content offset changes by
// `deltaY` (positive = scroll down, revealing content further below), clamped so it never
// requests a negative offset. Returns false when no scroll view is registered for the current
// screen (e.g. pomodoro.tsx has none, its targets are already always visible) so the caller can
// fall back to using the un-scrolled measurement instead of silently doing nothing.
export function scrollActiveViewBy(deltaY: number): boolean {
  if (!active) return false;
  active.scrollToY(Math.max(0, active.getOffsetY() + deltaY));
  return true;
}
