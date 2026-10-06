// Who asked to leave the block, for the exit sheet (BlockExitSheet) mounted once at the root:
// FocusBar, the pomodoro screen, or the phone's overlay (which already paused the session natively
// and opens the app with ?salir=1).

export interface ExitSheetRequest {
  /** The session is already paused (the exit happened on the overlay). */
  alreadyPaused: boolean;
}

type Listener = (request: ExitSheetRequest | null) => void;

let current: ExitSheetRequest | null = null;
const listeners = new Set<Listener>();

export function openExitSheet(request: ExitSheetRequest): void {
  current = request;
  listeners.forEach((listener) => listener(current));
}

export function closeExitSheet(): void {
  current = null;
  listeners.forEach((listener) => listener(null));
}

export function subscribeExitSheet(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}
