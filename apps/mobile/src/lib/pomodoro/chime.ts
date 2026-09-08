import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

// Phase-complete sound cue (task 7.29). Independent of the notification permission (task 6.4):
// a short chime is useful even with notifications off or the app foregrounded. Same asset as
// apps/web so both platforms sound identical. Metro bundles the require()'d wav automatically.

let player: AudioPlayer | null = null;

function getPlayer(): AudioPlayer | null {
  if (player) return player;
  try {
    // require() is the standard way to reference a Metro-bundled asset; the general
    // no-require-imports rule doesn't fit that case.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    player = createAudioPlayer(require('../../../assets/audio/pomodoro-chime.wav'));
    player.volume = 0.7;
    return player;
  } catch {
    return null;
  }
}

export function playPomodoroChime(): void {
  const p = getPlayer();
  if (!p) return;
  try {
    p.seekTo(0);
    p.play();
  } catch {
    // A missing/failed sound must never break a phase transition.
  }
}
