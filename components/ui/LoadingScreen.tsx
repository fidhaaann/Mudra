"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Music2 } from "lucide-react";
import { getMusicStatus, getServerMusicStatus, subscribeMusicStatus } from "@/lib/music-status";

// ─── image sources ────────────────────────────────────────────────────────────
// 600px WebP renditions of the 2858px PNG artwork: the frame is at most 180 CSS
// px (≤540 device px at 3×), and the originals cost ~9.7 MB to download and
// ~35 MB each to decode before the intro could advance.

const MUDRA_SRCS: string[] = [
  "/images/mudras/mudra-1.webp",
  "/images/mudras/mudra-2.webp",
  "/images/mudras/mudra-3.webp",
  "/images/mudras/mudra-4.webp",
  "/images/mudras/mudra-5.webp",
  "/images/mudras/mudra-6.webp",
];

const SEQUENCE_INDICES: number[] = [0, 2, 4, 1, 5, 3, 0, 4, 2, 5];
const LAST_STEP = SEQUENCE_INDICES.length - 1;

// ─── timing (ms) ─────────────────────────────────────────────────────────────
const HOLD_MS       = 210;
const CROSSFADE_MS  = 130;
const FINAL_HOLD_MS = 300;
const EXIT_MS       = 400;

// ─── helpers ─────────────────────────────────────────────────────────────────

function decodeImage(src: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      if (img.decode) {
        img.decode().then(resolve, resolve);
      } else {
        resolve();
      }
    };
    img.onerror = () => resolve();
    img.src = src;
  });
}

// ─── stone progress bar ──────────────────────────────────────────────────────

interface StoneBarProps {
  progress: number;
  reducedMotion: boolean;
}

function StoneBar({ progress, reducedMotion }: StoneBarProps) {
  const W        = 200;
  const H        = 8;
  const cx       = W / 2;
  const halfFill = (progress * W) / 2;
  const fillX    = cx - halfFill;
  const fillW    = halfFill * 2;
  const dur      = reducedMotion ? "none" : `${CROSSFADE_MS}ms ease-out`;

  return (
    <div
      className="flex flex-col items-center gap-3 w-full"
      // Same width as the mudra frame at every viewport.
      style={{ maxWidth: "clamp(96px, 28vw, 180px)" }}
      aria-hidden="true"
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          display: "block",
          overflow: "visible",
          height: "auto",
          aspectRatio: `${W} / ${H}`,
        }}
      >
        {/* Stone trough layers */}
        <rect x={0}   y={0}   width={W}     height={H}     fill="#0A0504" />
        <rect x={1}   y={1}   width={W - 2} height={H - 2} fill="#1A0D0D" />
        <rect x={1.5} y={1.5} width={W - 3} height={H - 3} fill="#130909" />

        {/* Edge chiselling lines */}
        <line x1={1}     y1={1}     x2={W - 1} y2={1}     stroke="#E3D28A" strokeWidth="0.5" strokeOpacity="0.35" />
        <line x1={1}     y1={H - 1} x2={W - 1} y2={H - 1} stroke="#000"    strokeWidth="0.5" strokeOpacity="0.60" />
        <line x1={1}     y1={1}     x2={1}     y2={H - 1} stroke="#E3D28A" strokeWidth="0.5" strokeOpacity="0.20" />
        <line x1={W - 1} y1={1}     x2={W - 1} y2={H - 1} stroke="#000"    strokeWidth="0.5" strokeOpacity="0.40" />

        {/* Stone tick marks */}
        {[25, 50, 75, 100, 125, 150, 175].map((tx) => (
          <line key={tx} x1={tx} y1={2} x2={tx} y2={H - 2}
            stroke="#E3D28A" strokeWidth="0.4" strokeOpacity="0.07" />
        ))}

        {fillW > 0 && (
          <>
            <rect
              x={fillX - 0.5} y={1.5} width={fillW + 1} height={H - 3}
              fill="#5A0E0B" fillOpacity="0.45"
              style={{ transition: `x ${dur}, width ${dur}` }}
            />
            <rect
              x={fillX} y={2} width={fillW} height={H - 4}
              fill="#E02E0B"
              style={{ transition: `x ${dur}, width ${dur}` }}
            />
            <line
              x1={fillX + 0.5} y1={2.5} x2={fillX + fillW - 0.5} y2={2.5}
              stroke="#EE4415" strokeWidth="0.8" strokeOpacity="0.55"
              style={{ transition: `x1 ${dur}, x2 ${dur}` }}
            />
            <line
              x1={fillX + 0.5} y1={2} x2={fillX + 0.5} y2={H - 2}
              stroke="#E3D28A" strokeWidth="0.8" strokeOpacity="0.5"
              style={{ transition: `x1 ${dur}, x2 ${dur}` }}
            />
            <line
              x1={fillX + fillW - 0.5} y1={2} x2={fillX + fillW - 0.5} y2={H - 2}
              stroke="#E3D28A" strokeWidth="0.8" strokeOpacity="0.5"
              style={{ transition: `x1 ${dur}, x2 ${dur}` }}
            />
            <rect x={cx - 0.75} y={2.5} width={1.5} height={H - 5}
              fill="#E3D28A" fillOpacity="0.4" />
          </>
        )}
      </svg>

      <div
        className="font-body text-[9px] tracking-[0.25em] text-[#E3D28A] uppercase"
        style={{ opacity: 0.3 }}
      >
        MUDRA
      </div>
    </div>
  );
}

// ─── etched lotus backdrop ───────────────────────────────────────────────────
// Static staggered lotus pattern carved into the background. One alpha-mask
// tile (staggering baked in) is repeated via CSS mask; offset shadow/highlight
// copies under a dark face give the recessed, etched edge.

const LOTUS_TILE = "url(/images/lotus-tile.png)";
// Tile is 608×784; width-only sizing keeps the flower aspect ratio.
const LOTUS_TILE_W = "clamp(150px, 36vw, 280px)";

function lotusLayer(dy: string, background: string): React.CSSProperties {
  const position = `50% calc(50% + ${dy})`;
  return {
    position:           "absolute",
    inset:              0,
    background,
    maskImage:          LOTUS_TILE,
    maskSize:           `${LOTUS_TILE_W} auto`,
    maskRepeat:         "repeat",
    maskPosition:       position,
    WebkitMaskImage:    LOTUS_TILE,
    WebkitMaskSize:     `${LOTUS_TILE_W} auto`,
    WebkitMaskRepeat:   "repeat",
    WebkitMaskPosition: position,
  };
}

// Paper tremble: three nested wrappers move the whole pattern as one layer
// (no per-flower loops). Co-prime durations and uneven keyframe stops keep the
// combined motion from reading as a loop. Cycles are short (~1–2.3s) because
// the whole intro only lasts ~2.5s; amplitudes stay around a pixel.
const LOTUS_TREMBLE_CSS = `
@keyframes lotus-drift {
  0%   { transform: translate3d(0, 0, 0); }
  14%  { transform: translate3d(0.8px, -0.5px, 0); }
  31%  { transform: translate3d(-0.4px, 0.9px, 0); }
  47%  { transform: translate3d(-1px, -0.2px, 0); }
  66%  { transform: translate3d(0.5px, 0.7px, 0); }
  84%  { transform: translate3d(-0.3px, -0.8px, 0); }
  100% { transform: translate3d(0, 0, 0); }
}
@keyframes lotus-sway {
  0%   { transform: rotate(0deg); }
  21%  { transform: rotate(0.1deg); }
  44%  { transform: rotate(-0.08deg); }
  69%  { transform: rotate(0.05deg); }
  86%  { transform: rotate(-0.09deg); }
  100% { transform: rotate(0deg); }
}
@keyframes lotus-breathe {
  0%   { transform: scale(1) skew(0deg, 0deg); }
  26%  { transform: scale(1.004) skew(0.08deg, -0.04deg); }
  53%  { transform: scale(0.997) skew(-0.05deg, 0.07deg); }
  78%  { transform: scale(1.003) skew(0.03deg, -0.06deg); }
  100% { transform: scale(1) skew(0deg, 0deg); }
}
.lotus-drift   { animation: lotus-drift   1.37s ease-in-out infinite; }
.lotus-sway    { animation: lotus-sway    1.91s ease-in-out infinite -0.7s; }
.lotus-breathe { animation: lotus-breathe 2.33s ease-in-out infinite -1.2s; will-change: transform; }
@media (prefers-reduced-motion: reduce) {
  .lotus-drift, .lotus-sway, .lotus-breathe { animation: none; }
}
`;

// Oversized so sub-degree rotation never exposes an uncovered edge.
const LOTUS_MOTION_BOX: React.CSSProperties = { position: "absolute", inset: "-16px" };

function LotusBackdrop() {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ zIndex: -1 }}
      aria-hidden="true"
    >
      <style>{LOTUS_TREMBLE_CSS}</style>
      <div className="lotus-drift" style={LOTUS_MOTION_BOX}>
        <div className="lotus-sway" style={{ position: "absolute", inset: 0 }}>
          <div className="lotus-breathe" style={{ position: "absolute", inset: 0 }}>
            {/* shadow along the upper edge of the cut */}
            <div style={lotusLayer("-1px", "rgba(0, 0, 0, 0.55)")} />
            {/* muted-gold catch-light along the lower edge */}
            <div style={lotusLayer("1px", "rgba(227, 210, 138, 0.075)")} />
            {/* recessed face: dark antique gold warming into brown at the edges */}
            <div
              style={lotusLayer(
                "0px",
                "radial-gradient(ellipse at 50% 45%, #2A2014 0%, #22190F 55%, #1B130D 100%)"
              )}
            />
          </div>
        </div>
      </div>
      {/* vignette keeps the centre and edges quiet */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(17,11,11,0.55) 0%, rgba(17,11,11,0) 32%), radial-gradient(ellipse at 50% 50%, rgba(17,11,11,0) 55%, rgba(10,6,6,0.7) 100%)",
        }}
      />
    </div>
  );
}

// ─── music hint ──────────────────────────────────────────────────────────────
// Browsers block sound until the visitor interacts, so invite a tap. Shown
// only while music is neither playing nor muted, after a short grace period
// (so it doesn't flash when autoplay is allowed), and hidden on first touch.
// Absolutely positioned: the mudra and progress bar don't move.

const HINT_DELAY_MS = 700;

function MusicHint({ reducedMotion }: { reducedMotion: boolean }) {
  const status = useSyncExternalStore(subscribeMusicStatus, getMusicStatus, getServerMusicStatus);
  const [armed, setArmed] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setArmed(true), HINT_DELAY_MS);
    const onTouch = () => setTouched(true);
    const opts = { capture: true, passive: true } as const;
    window.addEventListener("pointerdown", onTouch, opts);
    window.addEventListener("keydown", onTouch, opts);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", onTouch, opts);
      window.removeEventListener("keydown", onTouch, opts);
    };
  }, []);

  const show = armed && !touched && !!status && !status.playing && !status.muted;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 flex justify-center px-6"
      style={{
        bottom: "max(2.5rem, calc(env(safe-area-inset-bottom) + 1.5rem))",
        opacity: show ? 1 : 0,
        transition: reducedMotion ? "none" : "opacity 400ms ease",
      }}
    >
      <p className="text-center text-balance font-body text-[10px] sm:text-[11px] uppercase tracking-[0.16em] sm:tracking-[0.25em] text-[#E3D28A]/60">
        {/* Inline so it stays with the first word if the text wraps */}
        <Music2 aria-hidden="true" className="mr-2 inline-block size-3 align-[-2px]" strokeWidth={1.75} />
        Touch anywhere for the musical experience
      </p>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export const LoadingScreen: React.FC = () => {
  const shouldReduceMotion = useReducedMotion() ?? false;

  const [ready,   setReady]   = useState<boolean[]>(() => MUDRA_SRCS.map(() => false));
  const [step,    setStep]    = useState(0);
  const [visible, setVisible] = useState(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const previousOverflowRef = useRef("");

  // Progress derived from step — no extra state
  const barProgress = useMemo(() => step / LAST_STEP, [step]);

  // ── batch-decode all 6 images ─────────────────────────────────────────────
  useEffect(() => {
    previousOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let cancelled = false;

    Promise.all(MUDRA_SRCS.map(decodeImage)).then(() => {
      if (!cancelled) setReady(MUDRA_SRCS.map(() => true));
    });

    return () => {
      cancelled = true;
      document.body.style.overflow = previousOverflowRef.current;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // ── per-image decode (belt-and-suspenders) ────────────────────────────────
  useEffect(() => {
    const cleanups: (() => void)[] = [];
    MUDRA_SRCS.forEach((src, i) => {
      if (ready[i]) return;
      const img = new window.Image();
      const onReady = () =>
        setReady((prev) => {
          if (prev[i]) return prev;
          const n = [...prev];
          n[i] = true;
          return n;
        });
      img.onload  = () => { if (img.decode) { img.decode().then(onReady, onReady); } else { onReady(); } };
      img.onerror = () => onReady();
      img.src     = src;
      cleanups.push(() => { img.onload = null; img.onerror = null; });
    });
    return () => cleanups.forEach((f) => f());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── advance step ──────────────────────────────────────────────────────────
  const advance = useCallback(() => {
    setStep((prev) => (prev < LAST_STEP ? prev + 1 : prev));
  }, []);

  // ── begin exit ────────────────────────────────────────────────────────────
  // Dispatches "mudra:loading-done" AT THE SAME MOMENT the overlay starts
  // fading out, so FadeContent's hero reveal runs CONCURRENTLY with the
  // 400 ms exit fade — eliminating the black-screen gap between loading
  // overlay gone and hero visible.
  const beginExit = useCallback(() => {
    setVisible(false);
    document.body.style.overflow = previousOverflowRef.current;
    window.dispatchEvent(new CustomEvent("mudra:loading-done"));
  }, []);

  // ── sequencer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;

    const holdTime = shouldReduceMotion ? HOLD_MS * 1.5 : HOLD_MS;

    if (step >= LAST_STEP) {
      timerRef.current = setTimeout(beginExit, holdTime + FINAL_HOLD_MS);
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }

    const nextImgIdx = SEQUENCE_INDICES[step + 1];

    const scheduleAdvance = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(advance, holdTime);
    };

    if (ready[nextImgIdx]) {
      scheduleAdvance();
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }

    const poll = setInterval(() => {
      if (ready[nextImgIdx]) {
        clearInterval(poll);
        scheduleAdvance();
      }
    }, 16);
    return () => {
      clearInterval(poll);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [step, ready, visible, shouldReduceMotion, advance, beginExit]);

  // ── active image ──────────────────────────────────────────────────────────
  const activeIdx = useMemo(
    () => SEQUENCE_INDICES[Math.min(step, LAST_STEP)],
    [step]
  );

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="mudra-loading-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: EXIT_MS / 1000, ease: "easeInOut" }}
          className="fixed inset-0 z-9999 bg-[#110B0B] flex flex-col items-center justify-center gap-6 sm:gap-8 select-none overflow-hidden"
          aria-hidden="true"
        >
          <LotusBackdrop />

          <div
            className="relative shrink-0"
            style={{
              width:  "clamp(96px, 28vw, 180px)",
              height: "clamp(96px, 28vw, 180px)",
            }}
          >
            {MUDRA_SRCS.map((src, i) => {
              const isActive  = i === activeIdx;
              const isVisible = ready[i];
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt=""
                  draggable={false}
                  style={{
                    position:      "absolute",
                    inset:         0,
                    width:         "100%",
                    height:        "100%",
                    objectFit:     "contain",
                    opacity:       isVisible && isActive ? 1 : 0,
                    transform:     isActive ? "scale(1)" : "scale(0.97)",
                    transition:    shouldReduceMotion
                      ? "opacity 0ms"
                      : `opacity ${CROSSFADE_MS}ms ease-in-out, transform ${CROSSFADE_MS}ms ease-in-out`,
                    pointerEvents: "none",
                    userSelect:    "none",
                    willChange:    isActive ? "opacity, transform" : "auto",
                  }}
                />
              );
            })}
          </div>

          <StoneBar progress={barProgress} reducedMotion={shouldReduceMotion} />

          <MusicHint reducedMotion={shouldReduceMotion} />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
