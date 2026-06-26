const TUTORIAL_COMPLETED_KEY = 'calendar_web_tutorial_completed';

function hasLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function isTutorialCompleted(): boolean {
  if (!hasLocalStorage()) return false;
  return window.localStorage.getItem(TUTORIAL_COMPLETED_KEY) === 'true';
}

export function markTutorialCompleted(): void {
  if (!hasLocalStorage()) return;
  window.localStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');
}

export function resetTutorial(): void {
  if (!hasLocalStorage()) return;
  window.localStorage.removeItem(TUTORIAL_COMPLETED_KEY);
}
