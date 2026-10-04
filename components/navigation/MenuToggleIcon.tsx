"use client";

import { motion, useReducedMotion, type Transition, type Variants } from "framer-motion";

/**
 * Animated hamburger ⇄ close icon, ported from the "Menu - Open and close"
 * Lottie (100×100 comp, 60 fps) to Framer Motion so no Lottie player ships.
 *
 * Open  (frames 10→60): outer bars bounce outward, collapse to the centre,
 *                       then rotate into an X (outer −45°, centre +45°).
 * Close (frames 85→136): the X rotates back, then the bars bounce apart.
 *
 * Bars are 31×4 at 200% scale with a 2px radius → 62×8 / r4, centred on x 51.
 * Fill is currentColor so the button's existing colours and hover still apply.
 */

const FPS = 60;
const EASE = [0.333, 0, 0.667, 1] as const; // Lottie's o(0.333,0) → i(0.667,1)

// Keyframe timing in Lottie frames, relative to each sequence's first frame.
const OPEN_FRAMES = 50; // 10 → 60
const CLOSE_FRAMES = 51; // 85 → 136

function keyframes(frames: number, at: number[]): Transition {
  return {
    duration: frames / FPS,
    times: at.map((f) => f / frames),
    ease: at.slice(1).map(() => EASE),
  };
}

// Vertical offset of each outer bar from the centre line (y 50).
const OUTER_REST = 20; // resting at y 30 / y 70
const OUTER_BOUNCE = 28; // overshoot to y 22 / y 78

function outerBar(direction: -1 | 1, closedRotate: number): Variants {
  return {
    open: {
      y: [direction * OUTER_REST, direction * OUTER_BOUNCE, 0, 0],
      rotate: [0, 0, closedRotate],
      transition: {
        y: keyframes(OPEN_FRAMES, [0, 13, 26, 50]),
        rotate: keyframes(OPEN_FRAMES, [0, 30, 50]),
      },
    },
    closed: {
      y: [0, 0, direction * OUTER_BOUNCE, direction * OUTER_REST],
      rotate: [closedRotate, 0, 0],
      transition: {
        y: keyframes(CLOSE_FRAMES, [0, 25, 38, 51]),
        rotate: keyframes(CLOSE_FRAMES, [0, 20, 51]),
      },
    },
  };
}

const UPPER = outerBar(-1, -45);
const BOTTOM = outerBar(1, -45);
const CENTER: Variants = {
  open: { rotate: [0, 0, 45], transition: { rotate: keyframes(OPEN_FRAMES, [0, 30, 50]) } },
  closed: { rotate: [45, 0, 0], transition: { rotate: keyframes(CLOSE_FRAMES, [0, 20, 51]) } },
};

// Reduced motion: jump straight to the end state of each sequence.
const INSTANT = { duration: 0 };
const STATIC: Record<"upper" | "center" | "bottom", Variants> = {
  upper: {
    open: { y: 0, rotate: -45, transition: INSTANT },
    closed: { y: -OUTER_REST, rotate: 0, transition: INSTANT },
  },
  center: {
    open: { rotate: 45, transition: INSTANT },
    closed: { rotate: 0, transition: INSTANT },
  },
  bottom: {
    open: { y: 0, rotate: -45, transition: INSTANT },
    closed: { y: OUTER_REST, rotate: 0, transition: INSTANT },
  },
};

// Bars are drawn at the origin and placed by the wrapping <g> (centre 51, 50):
// on motion elements `x`/`y` are transforms, so they must not be used as the
// rect's position attributes.
const BAR = {
  width: 62,
  height: 8,
  rx: 4,
  style: { transformBox: "fill-box", transformOrigin: "center" },
} as const;

export function MenuToggleIcon({ open, size = 24 }: { open: boolean; size?: number }) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      initial={false}
      animate={open ? "open" : "closed"}
    >
      <g transform="translate(20 46)">
        <motion.rect {...BAR} variants={reducedMotion ? STATIC.bottom : BOTTOM} />
        <motion.rect {...BAR} variants={reducedMotion ? STATIC.center : CENTER} />
        <motion.rect {...BAR} variants={reducedMotion ? STATIC.upper : UPPER} />
      </g>
    </motion.svg>
  );
}
