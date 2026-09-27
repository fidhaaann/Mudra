"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

// ─── image sources ────────────────────────────────────────────────────────────

const MUDRA_SRCS: string[] = [
  "/images/mudras/mudra-1.png",
  "/images/mudras/mudra-2.png",
  "/images/mudras/mudra-3.png",
  "/images/mudras/mudra-4.png",
  "/images/mudras/mudra-5.png",
  "/images/mudras/mudra-6.png",
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
      style={{ maxWidth: "min(200px, 55vw)" }}
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

// ─── main component ───────────────────────────────────────────────────────────

export const LoadingScreen: React.FC = () => {
  const shouldReduceMotion = useReducedMotion() ?? false;

  const [ready,   setReady]   = useState<boolean[]>(() => MUDRA_SRCS.map(() => false));
  const [step,    setStep]    = useState(0);
  const [visible, setVisible] = useState(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Progress derived from step — no extra state
  const barProgress = useMemo(() => step / LAST_STEP, [step]);

  // ── batch-decode all 6 images ─────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = "hidden";
    let cancelled = false;

    Promise.all(MUDRA_SRCS.map(decodeImage)).then(() => {
      if (!cancelled) setReady(MUDRA_SRCS.map(() => true));
    });

    return () => {
      cancelled = true;
      document.body.style.overflow = "";
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
    document.body.style.overflow = "";
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
          className="fixed inset-0 z-[9999] bg-[#110B0B] flex flex-col items-center justify-center gap-6 sm:gap-8 select-none overflow-hidden"
          aria-hidden="true"
        >
          <div
            className="relative flex-shrink-0"
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
        </motion.div>
      )}
    </AnimatePresence>
  );
};
