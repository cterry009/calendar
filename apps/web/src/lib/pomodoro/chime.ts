import chimeUrl from '../../assets/audio/pomodoro-chime.wav';

// Phase-complete sound cue. Kept independent of the notification permission (task 6.4): a short
// chime is useful even with notifications off, and even with the tab focused where a Notification
// may not make any sound at all. Same asset as apps/mobile so both platforms sound identical.

let audio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  if (!audio) {
    audio = new Audio(chimeUrl);
    audio.preload = 'auto';
    audio.volume = 0.55;
  }
  return audio;
}

// Call from inside the user gesture that starts a pomodoro so the browser's autoplay policy lets
// the later programmatic play() (fired from a timer, not a click) through.
export function primePomodoroChime(): void {
  getAudio()?.load();
}

export function playPomodoroChime(): void {
  const el = getAudio();
  if (!el) return;
  try {
    el.currentTime = 0;
    void el.play().catch(() => {
      // Autoplay blocked (the user never interacted, or a strict tab policy) -- the visible
      // timer flip and the optional notification still convey the phase change.
    });
  } catch {
    // ignore -- a sound must never break a phase transition
  }
}
