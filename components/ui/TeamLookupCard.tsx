"use client";

import { useEffect, useRef, useState } from "react";
import Lanyard from "./Lanyard";
import type { HouseConfig } from "@/lib/houses";

/**
 * Team Lookup ID card: one React Bits <Lanyard /> whose front/back images
 * follow the lookup result. Faces are composed here (MUDRA frame + the
 * supplied artwork, untouched, or a neutral message) and handed to Lanyard
 * as image URLs, so the vendored component stays unmodified.
 */

export type CardStatus = "idle" | "searching" | "unavailable";

const STATUS_LINES: Record<CardStatus, string[]> = {
  idle: ["SEARCH YOUR NAME", "TO REVEAL YOUR HOUSE"],
  searching: ["SEARCHING…"],
  unavailable: ["HOUSE CARD", "UNAVAILABLE"],
};

// Lanyard portrait card is 1.6 × 2.25; faces are painted at 1024 px wide.
const FACE_W = 1024;
const FACE_H = 1440;
const BG = "#110B0B";
const GOLD = "#E3D28A";
const RED = "#E02E0B";
const LOGO_SRC = "/images/mudra-logo-dancer.png";

/** Student details printed on the card front. */
export interface CardStudent {
  name: string;
  semester: string;
  branch: string;
}

type Face =
  | { kind: "art"; src: string; student?: CardStudent }
  | { kind: "text"; lines: string[]; student?: CardStudent }
  | { kind: "logo" };

const studentKey = (s?: CardStudent) => (s ? `|${s.name}|${s.semester}|${s.branch}` : "");
const faceKey = (face: Face) =>
  face.kind === "art"
    ? `art:${face.src}${studentKey(face.student)}`
    : face.kind === "text"
      ? `text:${face.lines.join("|")}${studentKey(face.student)}`
      : "logo";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

const fontCache = new Map<string, Promise<string>>();
/** Resolve a next/font CSS variable to its family list, loaded for canvas use. */
function cssFont(variable: string, fallback: string): Promise<string> {
  let cached = fontCache.get(variable);
  if (!cached) {
    cached = (async () => {
      const family =
        getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || fallback;
      await document.fonts?.load(`700 52px ${family}`).catch(() => undefined);
      return family;
    })();
    fontCache.set(variable, cached);
  }
  return cached;
}
const displayFont = () => cssFont("--font-cinzel", "serif");
// Student details use the MUDRA display face (app/fonts/Wardrum-Bold.otf).
const detailsFont = () => cssFont("--font-wardrum", "sans-serif");

/**
 * Lay out one line of text centred at (x, y): shrinks from `max` to `min` px,
 * then wraps onto two lines (ellipsising the rest) rather than overflow.
 */
function fitLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  family: string,
  x: number,
  y: number,
  maxWidth: number,
  max: number,
  min: number
): number {
  for (let size = max; size >= min; size -= 2) {
    ctx.font = `700 ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) {
      ctx.fillText(text, x, y);
      return size;
    }
  }
  ctx.font = `700 ${min}px ${family}`;
  const words = text.split(/\s+/);
  const lines = [""];
  for (const word of words) {
    const next = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !lines[lines.length - 1]) {
      lines[lines.length - 1] = next;
    } else if (lines.length < 2) {
      lines.push(word);
    } else {
      lines[1] = `${lines[1]} ${word}`;
    }
  }
  lines.forEach((raw, i) => {
    let line = raw;
    while (line.length > 1 && ctx.measureText(line).width > maxWidth) line = `${line.slice(0, -2)}…`;
    ctx.fillText(line, x, y - (lines.length - 1) * min * 0.55 + i * min * 1.1);
  });
  return min;
}

function drawStudent(ctx: CanvasRenderingContext2D, student: CardStudent, family: string) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = GOLD;
  fitLine(ctx, student.name.toUpperCase(), family, FACE_W / 2, 1080, FACE_W - 200, 64, 38);
  ctx.globalAlpha = 0.75;
  fitLine(ctx, `SEM ${student.semester}  ·  ${student.branch}`.toUpperCase(), family, FACE_W / 2, 1185, FACE_W - 200, 40, 28);
  ctx.globalAlpha = 1;
}

let logoImage: Promise<HTMLImageElement | null> | null = null;
const logo = () => (logoImage ??= loadImage(LOGO_SRC).catch(() => null));

// Composed faces are reused across searches (blob URLs, keyed by content).
const faceCache = new Map<string, Promise<string>>();

function renderFace(face: Face): Promise<string> {
  const key = faceKey(face);
  let cached = faceCache.get(key);
  if (!cached) {
    cached = paintFace(face);
    faceCache.set(key, cached);
    cached.catch(() => faceCache.delete(key)); // let a failed load retry later
  }
  return cached;
}

async function paintFace(face: Face): Promise<string> {
  const student = face.kind === "logo" ? undefined : face.student;
  const [font, detailsFamily, mark, art] = await Promise.all([
    displayFont(),
    student ? detailsFont() : Promise.resolve(""),
    face.kind === "art" ? Promise.resolve(null) : logo(),
    face.kind === "art" ? loadImage(face.src) : Promise.resolve(null),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = FACE_W;
  canvas.height = FACE_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, FACE_W, FACE_H);
  ctx.strokeStyle = GOLD;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 4;
  ctx.strokeRect(48, 48, FACE_W - 96, FACE_H - 96);
  ctx.globalAlpha = 1;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = RED;
  ctx.fillRect(FACE_W / 2 - 80, FACE_H - 150, 160, 5);

  if (art) {
    // Supplied artwork, scaled uniformly — never stretched or recoloured.
    // With student details below it, the artwork sits higher on the face.
    const maxW = FACE_W - 160;
    const maxH = FACE_H - 480;
    const ratio = art.naturalWidth / art.naturalHeight || 1;
    let w = maxW;
    let h = w / ratio;
    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }
    const centreY = student ? 620 : FACE_H / 2 + 30;
    ctx.drawImage(art, (FACE_W - w) / 2, centreY - h / 2, w, h);
  } else {
    const logoY = face.kind === "logo" ? 520 : student ? 300 : 380;
    if (mark) {
      const w = 420;
      const h = w * (mark.naturalHeight / mark.naturalWidth || 0.75);
      ctx.drawImage(mark, (FACE_W - w) / 2, logoY, w, h);
    }
    if (face.kind === "text") {
      ctx.fillStyle = GOLD;
      ctx.globalAlpha = 0.85;
      ctx.font = `700 50px ${font}`;
      const top = student ? 760 : 920;
      face.lines.forEach((line, i) => ctx.fillText(line, FACE_W / 2, top + i * 74));
      ctx.globalAlpha = 1;
    }
  }
  if (student) drawStudent(ctx, student, detailsFamily);
  // Async encode (off the main thread) into a blob URL. Faces are cached for
  // the session, so the handful of URLs created are intentionally kept.
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not encode card face");
  return URL.createObjectURL(blob);
}

interface TeamLookupCardProps {
  /** Resolved house to show, or null for the neutral card. */
  house: HouseConfig | null;
  /** Student shown on the card front (name, semester, department). */
  student?: CardStudent;
  /** Neutral-card message when no house is shown. */
  status: CardStatus;
  /** Accessible description of the card. */
  label: string;
  /** Called when the house artwork fails to load. */
  onImageError: () => void;
}

export default function TeamLookupCard({ house, student, status, label, onImageError }: TeamLookupCardProps) {
  const details = student && { name: student.name, semester: student.semester, branch: student.branch };
  const front: Face = house
    ? { kind: "art", src: house.frontImage, student: details }
    : { kind: "text", lines: STATUS_LINES[status], student: details };
  const back: Face = house ? { kind: "art", src: house.backImage } : { kind: "logo" };
  const wantedKey = `${faceKey(front)}#${faceKey(back)}`;

  const [shown, setShown] = useState<{ key: string; front: string; back: string; isHouse: boolean } | null>(null);
  const onErrorRef = useRef(onImageError);
  useEffect(() => {
    onErrorRef.current = onImageError;
  }, [onImageError]);

  useEffect(() => {
    let cancelled = false;
    const isHouse = front.kind === "art";
    Promise.all([renderFace(front), renderFace(back)]).then(
      ([frontUrl, backUrl]) => {
        if (!cancelled) setShown({ key: wantedKey, front: frontUrl, back: backUrl, isHouse });
      },
      () => {
        if (!cancelled && isHouse) onErrorRef.current();
      }
    );
    return () => {
      cancelled = true;
    };
    // `front`/`back` are fully described by wantedKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedKey]);

  // Never show a previous house's card while the next card is being prepared.
  const visible = shown && (shown.key === wantedKey || !shown.isHouse) ? shown : null;

  // Lanyard mounts (and plays its drop-in) only once the first faces are
  // ready, so the card never drops in blank.
  const [ready, setReady] = useState(false);
  if (visible && !ready) setReady(true);

  return (
    <div role="img" aria-label={label} className="h-full w-full">
      {ready && <Lanyard
        frontImage={visible?.front}
        backImage={visible?.back}
        imageFit="contain"
        cardColor="#110b0b"
        finish="metallic"
        size={0.57}
        strapColor="#e02e0b"
        strapWidth={0.95}
        gravity={0.85}
        damping={0.6}
        breeze={0.6}
      />}
    </div>
  );
}
