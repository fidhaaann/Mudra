"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";

// Mounted once in the root layout. Layouts persist across App Router
// navigations, so this single Audio instance keeps playing between pages.

const MUSIC_SRC = "/music/mudra(bgm).MP3";
const VOLUME = 0.3;
const STORAGE_KEY = "mudra:bgm-muted";

// Events that reliably grant user activation for media playback, including on
// iOS Safari (pointerdown does not there, so it would only add a failed try).
const UNLOCK_EVENTS = ["click", "touchend", "keydown"] as const;

// The control stays unmounted while the loading screen is up; it appears once
// LoadingScreen dispatches this event. The audio itself starts independently.
const LOADING_DONE_EVENT = "mudra:loading-done";
// Safety net in case the event is missed (e.g. a dev hot-reload remount).
const CONTROL_FALLBACK_MS = 15000;
let loadingDone = false;

// ─── persisted mute preference ───────────────────────────────────────────────

let mutedPref: boolean | null = null;
const listeners = new Set<() => void>();

function readMuted(): boolean {
  if (mutedPref === null) {
    try {
      mutedPref = window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      mutedPref = false;
    }
  }
  return mutedPref;
}

function writeMuted(value: boolean) {
  mutedPref = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Storage unavailable (private mode etc.) — keep the in-memory value.
  }
  listeners.forEach((cb) => cb());
}

function subscribeMuted(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const getServerMuted = () => false;

// ─── component ───────────────────────────────────────────────────────────────

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

export function BackgroundMusic() {
  const muted = useSyncExternalStore(subscribeMuted, readMuted, getServerMuted);
  const [playing, setPlaying] = useState(false);
  const [controlVisible, setControlVisible] = useState(() => loadingDone);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const attemptingRef = useRef(false);
  const gaveUpRef = useRef(false);
  const addUnlockRef = useRef<() => void>(() => {});
  const removeUnlockRef = useRef<() => void>(() => {});
  // iOS ignores HTMLMediaElement.volume; route through a GainNode there instead.
  const volumeIgnoredRef = useRef(false);
  const ctxRef = useRef<AudioContext | null>(null);

  const attemptPlay = useCallback((fromGesture: boolean) => {
    const audio = audioRef.current;
    if (!audio || readMuted() || gaveUpRef.current) return;
    // Never start while the page is in the background.
    if (document.visibilityState === "hidden") return;
    if (attemptingRef.current || !audio.paused) return;

    if (fromGesture && volumeIgnoredRef.current) {
      try {
        if (!ctxRef.current) {
          const Ctx = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
          if (Ctx) {
            const ctx = new Ctx();
            const gain = ctx.createGain();
            gain.gain.value = VOLUME;
            ctx.createMediaElementSource(audio).connect(gain).connect(ctx.destination);
            ctxRef.current = ctx;
          }
        }
        if (ctxRef.current && ctxRef.current.state !== "running") {
          void ctxRef.current.resume().catch(() => {});
        }
      } catch {
        // Fall back to plain element playback at the device volume.
      }
    }

    attemptingRef.current = true;
    audio
      .play()
      .then(() => {
        removeUnlockRef.current();
      })
      .catch((err: unknown) => {
        const name = err instanceof DOMException ? err.name : "";
        // NotAllowedError: autoplay blocked — wait for the next real gesture.
        // AbortError: interrupted by pause() — harmless.
        // Anything else (unsupported/missing file): stop trying for good.
        if (name === "NotAllowedError") {
          addUnlockRef.current();
        } else if (name !== "AbortError") {
          gaveUpRef.current = true;
          removeUnlockRef.current();
        }
      })
      .finally(() => {
        attemptingRef.current = false;
      });
  }, []);

  // ── single audio instance for the app's lifetime ──────────────────────────
  useEffect(() => {
    const audio = new Audio();
    audio.src = MUSIC_SRC;
    audio.loop = true;
    // Buffer during the loading screen so playback begins the moment the
    // browser allows it; skip the download for users who muted it.
    audio.preload = readMuted() ? "none" : "auto";
    audio.volume = VOLUME;
    volumeIgnoredRef.current = Math.abs(audio.volume - VOLUME) > 0.01;
    audioRef.current = audio;
    gaveUpRef.current = false;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    // Backup for `loop`: some mobile browsers still fire "ended" at the end of
    // the track. Restart from the top unless the user has muted.
    const onEnded = () => {
      audio.currentTime = 0;
      attemptPlay(false);
    };
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    // Stop when the page goes to the background (tab switch, minimise, phone
    // home button / app switch, tab or browser closing) and resume on return.
    // This pause is not a mute: the saved preference is left untouched.
    const pauseForBackground = () => {
      audio.pause();
      void ctxRef.current?.suspend().catch(() => {});
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        pauseForBackground();
      } else {
        if (ctxRef.current && ctxRef.current.state !== "running") {
          void ctxRef.current.resume().catch(() => {});
        }
        attemptPlay(false);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", pauseForBackground);

    // One play attempt per genuine interaction until playback succeeds.
    const onInteract = (e: Event) => {
      if (!e.isTrusted) return;
      // The toggle button handles its own clicks.
      if (e.target instanceof Node && buttonRef.current?.contains(e.target)) return;
      attemptPlay(true);
    };
    let unlockAttached = false;
    addUnlockRef.current = () => {
      if (unlockAttached) return;
      unlockAttached = true;
      UNLOCK_EVENTS.forEach((type) =>
        window.addEventListener(type, onInteract, { capture: true, passive: true })
      );
    };
    addUnlockRef.current();
    removeUnlockRef.current = () => {
      if (!unlockAttached) return;
      unlockAttached = false;
      UNLOCK_EVENTS.forEach((type) =>
        window.removeEventListener(type, onInteract, { capture: true })
      );
    };

    // Single autoplay attempt; if the browser blocks it, the listeners above
    // retry on the next interaction.
    attemptPlay(false);

    return () => {
      removeUnlockRef.current();
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", pauseForBackground);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
      void ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
  }, [attemptPlay]);

  // ── control visibility (independent of the audio lifecycle) ───────────────
  useEffect(() => {
    if (controlVisible) return;
    const show = () => {
      loadingDone = true;
      setControlVisible(true);
    };
    const fallback = setTimeout(show, CONTROL_FALLBACK_MS);
    window.addEventListener(LOADING_DONE_EVENT, show);
    return () => {
      clearTimeout(fallback);
      window.removeEventListener(LOADING_DONE_EVENT, show);
    };
  }, [controlVisible]);

  const handleToggle = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (muted) {
      writeMuted(false);
      gaveUpRef.current = false;
      attemptPlay(true);
    } else if (audio.paused) {
      // Unmuted but blocked by autoplay policy: this click starts the music.
      attemptPlay(true);
    } else {
      writeMuted(true);
      audio.pause();
    }
  };

  const label = muted
    ? "Unmute background music"
    : playing
      ? "Mute background music"
      : "Play background music";

  if (!controlVisible) return null;

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={handleToggle}
      aria-label={label}
      title={label}
      className="glass-surface fixed right-4 sm:right-6 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-[#E3D28A]/25 bg-[#110B0B]/85 text-[#E3D28A] shadow-lg shadow-black/70 transition-[color,background-color,border-color,opacity] duration-300 starting:opacity-0 motion-reduce:transition-none hover:border-[#E3D28A]/50 hover:bg-[#5A0E0B]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E3D28A]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#110B0B]"
      style={{ bottom: "max(1rem, calc(env(safe-area-inset-bottom) + 0.5rem))" }}
    >
      {muted ? (
        <VolumeX aria-hidden="true" className="size-4.5 opacity-70" strokeWidth={1.75} />
      ) : (
        <Volume2
          aria-hidden="true"
          className={`size-4.5 ${playing ? "opacity-90" : "opacity-55"}`}
          strokeWidth={1.75}
        />
      )}
    </button>
  );
}
