"use client";

import React, { useEffect, useState, type CSSProperties } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { AwardsResponse } from "@/types/awards";

/**
 * Kalathilakam / Kalaprathibha winners, exactly as volunteers enter them in
 * AWARDS!A2:B2 (served by GET /api/awards). Nothing here is calculated:
 * blank names render "Not announced yet", a failed request "Unavailable".
 *
 * Each winner sits on a postage-stamp card (Figma "my-area", CARDS frames
 * 166:43 / 166:74): two tilted, blurred stamps behind a front stamp with a
 * cream perforated edge, a red inner frame and a faint dancer illustration.
 * The name is set in the empty lower half of the front stamp.
 *
 * The art is laid out in Figma pixels inside an 810 x 680 crop of the
 * 1150 x 894 frame, and scaled with container query units so the card
 * keeps its proportions at any width. Every state renders the same card,
 * so the section does not shift when the response arrives. The back stamps sway
 * like paper in a breeze (Sway); the front stamp ripples like a flag
 * (FlagStrips).
 */

type AwardsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: AwardsResponse };

type AwardKey = "kalathilakam" | "kalaprathibha";

interface DancerArt {
  src: string;
  width: number;
  height: number;
  /** Clip box in design px (relative to the crop). */
  box: { left: number; top: number; width: number; height: number };
  /** Image offset/height inside the clip box, as in Figma. */
  imgTop: string;
  imgHeight: string;
}

const AWARDS: { key: AwardKey; label: string; dancer: DancerArt }[] = [
  {
    key: "kalaprathibha",
    label: "KALAPRATHIBHA",
    dancer: {
      src: "/images/awards/dancer-male.webp",
      width: 1536,
      height: 2730,
      box: { left: 254, top: 62, width: 357, height: 330 },
      imgTop: "-45.35%",
      imgHeight: "192.25%",
    },
  },
  {
    key: "kalathilakam",
    label: "KALATHILAKAM",
    dancer: {
      src: "/images/awards/dancer-female.webp",
      width: 1472,
      height: 2616,
      box: { left: 264, top: 56, width: 345, height: 330 },
      imgTop: "-42.27%",
      imgHeight: "185.53%",
    },
  },
];

/* ---------- design-unit helpers ---------- */

const CROP_W = 810;
const CROP_H = 680;

/** Figma px -> CSS length that scales with the card (1u = card width / 810). */
const u = (n: number) => `calc(${n} * var(--u))`;

const box = (left: number, top: number, width: number, height: number): CSSProperties => ({
  position: "absolute",
  left: u(left),
  top: u(top),
  width: u(width),
  height: u(height),
});

/** Paint `color` through the alpha of a stamp-shaped mask image. */
function stampMask(
  src: string,
  size: number,
  offsetX: number,
  offsetY: number,
  color: string,
): CSSProperties {
  const image = `url("${src}")`;
  const position = `${u(-offsetX)} ${u(-offsetY)}`;
  const maskSize = `${u(size)} ${u(size)}`;
  return {
    backgroundColor: color,
    maskImage: image,
    WebkitMaskImage: image,
    maskSize,
    WebkitMaskSize: maskSize,
    maskPosition: position,
    WebkitMaskPosition: position,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
  };
}

/* ---------- stamp art ---------- */

const STAMP_BG = "#110B0B";
const STAMP_RED = "#E02E0B";
const STAMP_CREAM = "#FCFBB9";

/**
 * Red frame shared by all three stamps: a 5px stroke drawn OUTSIDE the
 * Figma rectangle at 50% opacity, so the box grows 5px on every side.
 */
const STROKE = 5;
function frame(left: number, top: number, width: number, height: number): CSSProperties {
  return {
    ...box(left - STROKE, top - STROKE, width + STROKE * 2, height + STROKE * 2),
    border: `${u(STROKE)} solid ${STAMP_RED}`,
    opacity: 0.5,
  };
}

/**
 * One tilted back stamp: a 297 x 452 red frame rotated about its top-left
 * corner, with the perforated stamp centred on it. Slightly blurred, as in
 * the design. `stampWidth` was fitted against the Figma export.
 */
function BackStamp({
  left,
  top,
  rotate,
  stampWidth,
}: {
  left: number;
  top: number;
  rotate: number;
  stampWidth: number;
}) {
  // Stamp shape (stamp-back.webp, 1366px square, shape at 313,157 / 726 x 1049)
  // scaled to `stampWidth` and centred on the frame.
  const s = stampWidth / 726;
  const stampW = 726 * s;
  const stampH = 1049 * s;
  const frameW = 297.223;
  const frameH = 452.259;
  return (
    <div
      style={{
        ...box(left, top, frameW, frameH),
        transform: `rotate(${rotate}deg)`,
        transformOrigin: "0 0",
        filter: `blur(${u(3.5)})`,
      }}
    >
      <div
        style={{
          ...box((frameW - stampW) / 2, (frameH - stampH) / 2, stampW, stampH),
          ...stampMask("/images/awards/stamp-back.webp", 1366 * s, 313 * s, 157 * s, STAMP_BG),
        }}
      />
      <div style={frame(0, 0, frameW, frameH)} />
    </div>
  );
}

/**
 * Back stamps: wind-blown paper motion. Each sways on its own pivot (the
 * middle of its top edge) with its own period and phase, so they never move
 * in lockstep. Keyframes live in globals.css (.paper-sway-soft).
 */
function Sway({
  originX,
  originY,
  duration,
  delay,
  children,
}: {
  /** Pivot in design px (relative to the crop). */
  originX: number;
  originY: number;
  duration: number;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="absolute inset-0 paper-sway-soft"
      style={{
        transformOrigin: `${(originX / CROP_W) * 100}% ${(originY / CROP_H) * 100}%`,
        animationDuration: `${duration}s`,
        animationDelay: `${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Front stamp: a flag rippling in a steady breeze.
 *
 * A single layer can only tilt, not ripple, so the front stamp is drawn in
 * FLAG.strips vertical slices. Every slice runs the same sine wave
 * (.flag-wave: lift + matching shear) a little later than the slice to its
 * left, so a ripple travels left -> right. The left edge is the "pole" and
 * barely moves; amplitude grows toward the free right edge. Transform only,
 * so it runs on the compositor; reduced motion leaves the slices at rest,
 * which reassembles the flat stamp.
 */
const FLAG = {
  strips: 12,
  /** Horizontal extent of the front stamp (cream edge), design px. */
  x0: 215.5,
  x1: 650,
  period: 3.4, // s per wave cycle
  wavelength: 560, // design px
  ampMin: 1.2, // design px at the pole (left edge)
  ampMax: 6.5, // design px at the free (right) edge
  /** Slices overlap by this much so no hairline seams show. */
  overlap: 0.6,
};

function FlagStrips({ phase, children }: { phase: number; children: React.ReactNode }) {
  const { strips, x0, x1, period, wavelength, ampMin, ampMax, overlap } = FLAG;
  const w = (x1 - x0) / strips;
  const k = (2 * Math.PI) / wavelength;
  const pct = (n: number) => `${(n / CROP_W) * 100}%`;

  return (
    <>
      {Array.from({ length: strips }, (_, i) => {
        const left = i === 0 ? 0 : x0 + i * w - overlap;
        const right = i === strips - 1 ? CROP_W : x0 + (i + 1) * w + overlap;
        const cx = x0 + (i + 0.5) * w;
        const amp = ampMin + ((ampMax - ampMin) * i) / (strips - 1);
        // Shear that matches the wave's slope, so neighbouring slices meet.
        const shear = (-Math.atan(amp * k) * 180) / Math.PI;
        // Phase lag grows with distance from the pole -> wave travels right.
        const lag = (((cx - x0) / wavelength) % 1) * period;
        return (
          <div
            key={i}
            className="absolute inset-0 flag-wave"
            style={{
              animationDuration: `${period}s`,
              animationDelay: `${lag - period - phase}s`,
              clipPath: `inset(-12% ${pct(CROP_W - right)} -12% ${pct(left)})`,
              transformOrigin: `${pct(cx)} 50%`,
              ["--a" as string]: u(amp),
              ["--s" as string]: `${shear}deg`,
            }}
          >
            {children}
          </div>
        );
      })}
    </>
  );
}

function StampArt({
  dancer,
  phase,
  children,
}: {
  dancer: DancerArt;
  /** Per-card offset in seconds so neighbouring cards drift independently. */
  phase: number;
  /** Text drawn on the front stamp; it ripples with the flag. */
  children: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0" style={{ perspective: u(1400) }}>
      <Sway originX={199.4} originY={155.6} duration={7.8} delay={-2 - phase}>
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none select-none">
          <BackStamp left={61.5} top={211.04} rotate={-21.9} stampWidth={375} />
        </div>
      </Sway>
      <Sway originX={625.7} originY={148.7} duration={7.1} delay={-4.6 - phase}>
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none select-none">
          <BackStamp left={481.56} top={112.52} rotate={14.11} stampWidth={360} />
        </div>
      </Sway>
      <FlagStrips phase={phase}>
        <FrontStamp dancer={dancer} />
        {children}
      </FlagStrips>
    </div>
  );
}

function FrontStamp({ dancer }: { dancer: DancerArt }) {
  return (
    <div aria-hidden="true" className="absolute inset-0 pointer-events-none select-none">
      {/* Front stamp: cream perforated edge, dark face, red frame */}
      <div
        style={{
          ...box(215.5, 9, 434.5, 628),
          ...stampMask("/images/awards/stamp-edge.webp", 817, 187.5, 94, STAMP_CREAM),
          opacity: 0.41,
        }}
      />
      <div
        style={{
          ...box(218.5, 13.5, 428, 618.5),
          ...stampMask("/images/awards/stamp-face.webp", 805, 184.5, 92.5, STAMP_BG),
        }}
      />
      <div style={frame(259, 56, 347, 528)} />

      {/* Dancer illustration at 14% opacity */}
      <div
        className="overflow-hidden"
        style={{
          ...box(dancer.box.left, dancer.box.top, dancer.box.width, dancer.box.height),
          opacity: 0.14,
        }}
      >
        <Image
          src={dancer.src}
          alt=""
          width={dancer.width}
          height={dancer.height}
          sizes="(min-width: 640px) 200px, 45vw"
          className="absolute left-0 w-full max-w-none"
          style={{ top: dancer.imgTop, height: dancer.imgHeight }}
        />
      </div>
    </div>
  );
}

/**
 * Names are stacked on two lines: the first word on top, the rest below
 * ("ANJALI MENON" -> "ANJALI" / "MENON"). A single-word name stays on one line.
 */
function splitName(name: string): string[] {
  const words = name.trim().split(/\s+/);
  return words.length > 1 ? [words[0], words.slice(1).join(" ")] : words;
}

/**
 * The display face is wide and all-caps, so the size steps down with the
 * longest line to keep it inside the red frame (design px; still scales
 * with the card).
 */
function nameFontSize(lines: string[]): number {
  const n = Math.max(...lines.map((line) => line.length));
  if (n <= 10) return 38;
  if (n <= 13) return 31;
  if (n <= 15) return 26;
  return 22;
}

/**
 * Title + winner name, set in the empty lower half of the front stamp's red
 * frame. Purely visual (it is repeated in every flag slice); the accessible
 * text is rendered once, visually hidden, by the card.
 */
function CardText({
  label,
  name,
  status,
}: {
  label: string;
  name: string | null;
  status: AwardsState["status"];
}) {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col items-center justify-center text-center pointer-events-none select-none"
      style={{ ...box(276, 392, 313, 182), gap: u(10) }}
    >
      <div
        className="font-display tracking-widest text-[#E02E0B] uppercase font-bold leading-none"
        style={{ fontSize: u(24) }}
      >
        {label}
      </div>
      <div
        className="font-display font-bold leading-[1.15] text-[#E3D28A] wrap-break-word max-w-full"
        style={{ fontSize: u(name ? nameFontSize(splitName(name)) : 38), minHeight: "1.15em" }}
      >
        {status === "loading" ? (
          <span
            className="block h-[1.15em] mx-auto bg-[#E3D28A]/10 animate-pulse motion-reduce:animate-none"
            style={{ width: u(220) }}
          />
        ) : name ? (
          splitName(name).map((line, i) => (
            <span key={i} className="block">
              {line}
            </span>
          ))
        ) : (
          <span className="font-body font-normal italic text-[#E3D28A]/50" style={{ fontSize: u(26) }}>
            {status === "error" ? "Unavailable right now" : "Not announced yet"}
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------- component ---------- */

export function AwardWinners({ className }: { className?: string }) {
  const [state, setState] = useState<AwardsState>({ status: "loading" });

  useEffect(() => {
    let ignore = false;
    async function fetchAwards() {
      try {
        const res = await fetch("/api/awards");
        if (!res.ok) throw new Error(`Failed to load awards (status ${res.status})`);
        const data = await res.json() as AwardsResponse;
        if (!ignore) setState({ status: "ready", data });
      } catch {
        if (!ignore) setState({ status: "error" });
      }
    }
    fetchAwards();
    return () => { ignore = true; };
  }, []);

  return (
    <section aria-labelledby="award-winners-heading" className={cn("space-y-2 min-w-0", className)}>
      <h2
        id="award-winners-heading"
        className="font-display text-xs tracking-widest text-[#E3D28A]/60 uppercase"
      >
        Individual Championship
      </h2>

      <ul
        className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2"
        aria-busy={state.status === "loading"}
      >
        {AWARDS.map(({ key, label, dancer }, index) => {
          const name = state.status === "ready" ? state.data[key] : null;
          return (
            <li
              key={key}
              className="relative w-full max-w-105 mx-auto min-w-0"
              style={{
                aspectRatio: `${CROP_W} / ${CROP_H}`,
                containerType: "inline-size",
                ["--u" as string]: `calc(100cqw / ${CROP_W})`,
              }}
            >
              {/* Real text for assistive tech; the visible copy is drawn into each flag slice. */}
              <h3 className="sr-only">{label}</h3>
              <p className="sr-only">
                {state.status === "loading"
                  ? "Loading"
                  : name ?? (state.status === "error" ? "Unavailable right now" : "Not announced yet")}
              </p>

              <StampArt dancer={dancer} phase={index * 1.7}>
                <CardText label={label} name={name} status={state.status} />
              </StampArt>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
