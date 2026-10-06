import { markBlockReviewed } from '../focusBlock/api';
import { platformStorage } from '../platformStorage';

// The per-pomodoro review (BlockReviewSheet), mounted once at the root: opened by useBlockFocus when
// a block's focus pomodoro ends with the app in front, or by the phone's own card (which opens the
// app with the rating already picked). Each pomodoro is reviewed once.

export interface ReviewRequest {
  scheduleId: string;
  /** "<pomodoro session id>#<cycle>": one review per focus pomodoro. */
  key: string;
  taskId: string | null;
  sessionId: string;
  /** Which pomodoro of the block (1-based). */
  cycle: number;
  /** Ask whether the study session got done (its last pomodoro, or the block's). */
  askSession: boolean;
  /** Picked on the phone's card already. */
  rating?: number;
}

export function pomodoroReviewRequest(
  sessionId: string,
  cycle: number,
  scheduleId: string,
  taskId: string | null,
  extra: { askSession: boolean; rating?: number },
): ReviewRequest {
  return { key: `${sessionId}#${cycle}`, sessionId, cycle, scheduleId, taskId, ...extra };
}

type Listener = (request: ReviewRequest | null) => void;

let current: ReviewRequest | null = null;
const listeners = new Set<Listener>();
const STORAGE_KEY = 'calendar:reviewed-blocks';
let reviewed: Set<string> | null = null;

async function loadReviewed(): Promise<Set<string>> {
  if (reviewed) return reviewed;
  try {
    const raw = await platformStorage.getItem(STORAGE_KEY);
    reviewed = new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    reviewed = new Set();
  }
  return reviewed;
}

export async function isReviewed(key: string): Promise<boolean> {
  return (await loadReviewed()).has(key);
}

/** Done with this block's review (answered or dismissed): it isn't asked again, here or natively. */
export async function markReviewed(key: string): Promise<void> {
  const set = await loadReviewed();
  set.add(key);
  void platformStorage.setItem(STORAGE_KEY, JSON.stringify([...set].slice(-60))).catch(() => undefined);
  markBlockReviewed(key);
}

export async function openReviewSheet(request: ReviewRequest): Promise<void> {
  if (await isReviewed(request.key)) return;
  current = request;
  listeners.forEach((listener) => listener(current));
}

export function closeReviewSheet(): void {
  current = null;
  listeners.forEach((listener) => listener(null));
}

export function subscribeReviewSheet(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}
