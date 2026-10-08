/**
 * Tiny shared channel for the background-music state, so UI outside the
 * player (e.g. the loading screen's "touch anywhere" hint) can react to it
 * without owning or touching the audio element.
 */

export interface MusicStatus {
  playing: boolean;
  muted: boolean;
}

const MUSIC_STATUS_EVENT = "mudra:music-status";
let current: MusicStatus | null = null;

/** Called by BackgroundMusic whenever playing/muted changes. */
export function publishMusicStatus(status: MusicStatus) {
  if (current && current.playing === status.playing && current.muted === status.muted) return;
  current = status;
  window.dispatchEvent(new Event(MUSIC_STATUS_EVENT));
}

export function subscribeMusicStatus(callback: () => void) {
  window.addEventListener(MUSIC_STATUS_EVENT, callback);
  return () => window.removeEventListener(MUSIC_STATUS_EVENT, callback);
}

/** Latest status, or null before the player has reported anything. */
export function getMusicStatus(): MusicStatus | null {
  return current;
}

export const getServerMusicStatus = (): MusicStatus | null => null;
