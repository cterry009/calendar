import { markBlockReviewed } from '../focusBlock/api';
import { platformStorage } from '../platformStorage';

// The end-of-block review (BlockReviewSheet), mounted once at the root: opened by useBlockFocus when
// a block's session ends with the app in front, or by the phone's end-of-block card (which opens
// the app with the rating already picked). Each block occurrence is reviewed once.

export interface ReviewRequest {
  scheduleId: string;
  /** blockOccurrenceKey of the block being reviewed. */
  key: string;
  taskId: string | null;
  /** Picked on the phone's card already. */
  rating?: number;
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
