import { platformStorage } from '../platformStorage';

// Separate key from apps/web's 'calendar_web_tutorial_completed' -- these are two different
// onboarding flows (different screens, different tour registry) with independent completion
// state, not a shared setting synced across platforms.
const TUTORIAL_COMPLETED_KEY = 'calendar_mobile_tutorial_completed';

export async function isTutorialCompleted(): Promise<boolean> {
  const value = await platformStorage.getItem(TUTORIAL_COMPLETED_KEY);
  return value === 'true';
}

export async function markTutorialCompleted(): Promise<void> {
  await platformStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');
}

export async function resetTutorial(): Promise<void> {
  await platformStorage.removeItem(TUTORIAL_COMPLETED_KEY);
}
