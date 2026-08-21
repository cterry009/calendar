// Native has no DOM `document.querySelector('[data-tutorial="..."]')` equivalent (the mechanism
// apps/web's OnboardingTutorial.tsx uses to find a step's target), so `TutorialTarget.tsx` wraps
// each highlightable element in a plain `View` and registers a `measureInWindow`-backed lookup
// here instead. A plain module-scoped Map on purpose, not React context state -- registration
// happens on every mount/unmount of every wrapped element across the whole app, and none of that
// should trigger a re-render; only OnboardingTutorial.tsx (which reads this imperatively, driven
// by activeTourId/stepIndex) cares about the current value.
export interface MeasuredRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type MeasureFn = () => Promise<MeasuredRect | null>;

const registry = new Map<string, MeasureFn>();

export function registerTutorialTarget(id: string, measure: MeasureFn): () => void {
  registry.set(id, measure);
  return () => {
    // Only clear the slot if it's still this registration -- a step can navigate away and a new
    // screen with the same target id can mount before the old one's cleanup effect runs.
    if (registry.get(id) === measure) {
      registry.delete(id);
    }
  };
}

export function measureTutorialTarget(id: string): Promise<MeasuredRect | null> {
  const measure = registry.get(id);
  return measure ? measure() : Promise.resolve(null);
}
