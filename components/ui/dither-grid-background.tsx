"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { effectDprCap, getPerfTier } from "@/lib/perf-tier";

const PALETTE = ["#110B0B", "#5A0E0B", "#E02E0B", "#EE8814", "#E3D28A"] as const;
const DITHER_CELL_SIZE = 56;
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const CONFIG = {
  angle: 90,
  centerX: 50,
  centerY: 50,
  scale: 68,
  softness: 26,
  wave: 12,
  distortion: 28,
  grain: 100,
  vignette: 100,
  count: 6,
  fade: 40,
  spread: -20,
  pixelAngle: 62,
  pixelDither: 76,
  pixelGap: 7,
  archBase: 70,
  archHeight: 50,
  archWidth: 100,
  archGlow: 55,
  archEdge: 30,
  seed: 233428675,
} as const;

function hash(x: number, y: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7 + CONFIG.seed) * 43758.5453;
  return value - Math.floor(value);
}

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

// ─── colour lookup ───────────────────────────────────────────────────────────
// Tone → packed RGBA (ImageData byte order), precomputed once instead of
// building an rgb() string per sub-pixel per frame. 256 steps per palette
// segment keeps every channel within one level of the exact interpolation.

const LUT_STEPS = 256;
const MAX_TONE = PALETTE.length - 1;
const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

const COLOR_LUT = (() => {
  const lut = new Uint32Array(MAX_TONE * LUT_STEPS + 1);
  const rgb = PALETTE.map(hexToRgb);
  for (let i = 0; i < lut.length; i++) {
    const scaled = i / LUT_STEPS;
    const index = Math.min(PALETTE.length - 2, Math.floor(scaled));
    const remainder = scaled - index;
    const [r, g, b] = rgb[index].map((channel, c) =>
      Math.round(channel + (rgb[index + 1][c] - channel) * remainder)
    );
    lut[i] = LITTLE_ENDIAN
      ? ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
      : ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0;
  }
  return lut;
})();

// Per-sub-pixel tone offset: Bayer threshold + diagonal bias (row-major 4×4).
const SUB_OFFSETS = Float32Array.from({ length: 16 }, (_, i) => {
  const subRow = i >> 2;
  const subColumn = i & 3;
  const threshold = (BAYER_4X4[subRow][subColumn] + 0.5) / 16;
  return (threshold - 0.5) * (CONFIG.pixelDither / 100) + (subColumn - subRow) * 0.01;
});

const SUB_SIZE = DITHER_CELL_SIZE / 4;
const GAP = Math.min(CONFIG.pixelGap / 10, SUB_SIZE * 0.3);

// The pattern is defined over a virtual surface of (1 + 2 × 100%) of the
// viewport per axis — the original paint overscan — so the grid geometry and
// motion are unchanged. Only a smaller window around the viewport is painted.
const VIRTUAL_SCALE = 3;
const PAINT_OVERSCAN = 0.25; // fraction of the viewport painted beyond each edge
const ELEMENT_SCALE = 1 + PAINT_OVERSCAN * 2;

// ─── rendering strategy ──────────────────────────────────────────────────────
// Each frame only writes one pixel per sub-cell into a tiny canvas (a few
// thousand pixels); the compositor scales that canvas up to the 14px sub-cells
// with nearest-neighbour sampling (`image-rendering: pixelated`), and the gap
// lines live on a second, static canvas drawn once per resize.
//
// Why: the previous path raster-painted the whole viewport-sized backing store
// every frame (fill + scaled drawImage + gap-layer drawImage). That is cheap
// where 2D canvas is GPU-accelerated (Chromium) but measured ~7 fps in WebKit
// at 3× device pixel ratio vs ~50 fps without the canvas, because WebKit paints
// 2D canvas content on the CPU. Scaling in the compositor removes that cost in
// every engine.
//
// Feature detection, not browser detection: without `pixelated` support the
// cell canvas is rendered at FALLBACK_SCALE pixels per sub-cell instead, so any
// smoothing the browser applies stays within the ~1px band hidden by the gaps.
const FALLBACK_SCALE = 7;
const supportsPixelated = () =>
  typeof CSS !== "undefined" && CSS.supports?.("image-rendering", "pixelated") === true;

interface Field {
  cols: number;
  rows: number;
  // Static per-cell terms (time-independent parts of the tone function)
  baseTone: Float32Array;
  waveX: Float32Array;
  waveY: Float32Array;
  // Device pixels per sub-cell in the cell canvas (1 when the compositor
  // scales with nearest-neighbour sampling)
  scale: number;
  image: ImageData;
  pixels: Uint32Array;
  // Cell window position/size inside the element, in CSS px
  drawX: number;
  drawY: number;
  gaps: Path2D;
}

function buildField(width: number, height: number, scale: number): Field | null {
  const virtualWidth = (width / ELEMENT_SCALE) * VIRTUAL_SCALE;
  const virtualHeight = (height / ELEMENT_SCALE) * VIRTUAL_SCALE;
  const offsetX = (virtualWidth - width) / 2;
  const offsetY = (virtualHeight - height) / 2;

  const pixelCols = Math.ceil(virtualWidth / DITHER_CELL_SIZE);
  const pixelRows = Math.ceil(virtualHeight / DITHER_CELL_SIZE);
  const col0 = Math.max(0, Math.floor(offsetX / DITHER_CELL_SIZE));
  const row0 = Math.max(0, Math.floor(offsetY / DITHER_CELL_SIZE));
  const col1 = Math.min(pixelCols, Math.ceil((offsetX + width) / DITHER_CELL_SIZE));
  const row1 = Math.min(pixelRows, Math.ceil((offsetY + height) / DITHER_CELL_SIZE));
  const cols = col1 - col0;
  const rows = row1 - row0;
  if (cols <= 0 || rows <= 0) return null;

  const image = new ImageData(cols * 4 * scale, rows * 4 * scale);

  const angle = (CONFIG.pixelAngle * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const baseTone = new Float32Array(cols * rows);
  const waveX = new Float32Array(cols * rows);
  const waveY = new Float32Array(cols * rows);

  for (let r = 0; r < rows; r++) {
    const row = row0 + r;
    for (let c = 0; c < cols; c++) {
      const column = col0 + c;
      const centeredX = (column + 0.5) / pixelCols - CONFIG.centerX / 100;
      const centeredY = (row + 0.5) / pixelRows - CONFIG.centerY / 100;
      const rotatedX = centeredX * cos - centeredY * sin;
      const rotatedY = centeredX * sin + centeredY * cos;
      const distance = Math.sqrt(centeredX ** 2 + centeredY ** 2);
      const arch = Math.max(
        0,
        1 -
          Math.abs(rotatedX) / (CONFIG.archWidth / 100) -
          Math.max(0, rotatedY + CONFIG.archBase / 100 - 1) *
            (CONFIG.archHeight / 25)
      );
      const grain = (hash(column, row) - 0.5) * (CONFIG.grain / 1000);
      const vignette = Math.max(0, 1 - distance * (CONFIG.vignette / 1.5));
      const i = r * cols + c;
      baseTone[i] = 0.35 + arch * 0.18 + vignette * 0.1 + grain;
      waveX[i] = rotatedX * CONFIG.scale * 0.12;
      waveY[i] = rotatedY * CONFIG.wave;
    }
  }

  const drawX = col0 * DITHER_CELL_SIZE - offsetX;
  const drawY = row0 * DITHER_CELL_SIZE - offsetY;
  const gaps = new Path2D();
  for (let k = 0; k <= cols * 4; k++) {
    gaps.rect(drawX + k * SUB_SIZE - GAP, drawY, GAP * 2, rows * DITHER_CELL_SIZE);
  }
  for (let k = 0; k <= rows * 4; k++) {
    gaps.rect(drawX, drawY + k * SUB_SIZE - GAP, cols * DITHER_CELL_SIZE, GAP * 2);
  }

  return {
    cols, rows, baseTone, waveX, waveY, scale,
    image, pixels: new Uint32Array(image.data.buffer),
    drawX, drawY, gaps,
  };
}

/** Writes this frame's colours into the cell canvas (one block per sub-cell). */
function drawDither(context: CanvasRenderingContext2D, field: Field, time: number) {
  const { cols, rows, baseTone, waveX, waveY, pixels, scale } = field;
  const ph = time * 0.71;
  const amt = 0.6;
  const dir = 1;
  const spin = ph * dir;
  const modulation = Math.sin(ph * 0.9 * dir) * 0.5 * amt;
  const distortion = CONFIG.distortion / 10;
  const stride = cols * 4 * scale;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const wave = Math.sin(waveX[i] + Math.sin(waveY[i] + spin) * distortion + spin);
      const tone = Math.max(
        0,
        Math.min(MAX_TONE, (baseTone[i] + wave * 0.12) * MAX_TONE + modulation)
      );
      for (let sub = 0; sub < 16; sub++) {
        const ditherTone = tone + SUB_OFFSETS[sub];
        const clamped = ditherTone < 0 ? 0 : ditherTone > MAX_TONE ? MAX_TONE : ditherTone;
        const color = COLOR_LUT[(clamped * LUT_STEPS + 0.5) | 0];
        const x = (c * 4 + (sub & 3)) * scale;
        const y = (r * 4 + (sub >> 2)) * scale;
        if (scale === 1) {
          pixels[y * stride + x] = color;
        } else {
          for (let dy = 0; dy < scale; dy++) {
            const start = (y + dy) * stride + x;
            pixels.fill(color, start, start + scale);
          }
        }
      }
    }
  }

  context.putImageData(field.image, 0, 0);
}

function DitherGridCanvas({
  contained = false,
  startAfterHero = false,
}: {
  contained?: boolean;
  startAfterHero?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const cellsRef = useRef<HTMLCanvasElement>(null);
  const gapsRef = useRef<HTMLCanvasElement>(null);
  const pathname = usePathname();
  // Set while an opaque element (the home hero) covers the whole viewport.
  const occludedRef = useRef(false);
  const syncRef = useRef<() => void>(() => {});

  useEffect(() => {
    const root = rootRef.current;
    const cells = cellsRef.current;
    const gapCanvas = gapsRef.current;
    if (!root || !cells || !gapCanvas) return;
    const context = cells.getContext("2d", { alpha: false });
    const gapContext = gapCanvas.getContext("2d");
    if (!context || !gapContext) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const tier = getPerfTier();
    const frameInterval = tier === "low" ? 1000 / 30 : 0;
    const pixelated = supportsPixelated();
    const scale = pixelated ? 1 : FALLBACK_SCALE;
    cells.style.imageRendering = pixelated ? "pixelated" : "auto";

    let animationFrame = 0;
    let running = false;
    let lastFrame = 0;
    let width = 0;
    let height = 0;
    let gapDpr = 0;
    let currentTime = 0;
    let field: Field | null = null;

    const draw = () => {
      if (field) drawDither(context, field, currentTime);
    };

    const resize = () => {
      const nextWidth = Math.max(1, root.clientWidth);
      const nextHeight = Math.max(1, root.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, effectDprCap(tier));
      if (nextWidth === width && nextHeight === height && dpr === gapDpr) return;

      width = nextWidth;
      height = nextHeight;
      gapDpr = dpr;
      field = buildField(width, height, scale);
      if (!field) return;

      // CSS dimensions define the visual grid; the cell canvas is placed and
      // sized in CSS px and holds only `scale` device pixels per sub-cell.
      cells.width = field.cols * 4 * scale;
      cells.height = field.rows * 4 * scale;
      cells.style.left = `${field.drawX}px`;
      cells.style.top = `${field.drawY}px`;
      cells.style.width = `${field.cols * DITHER_CELL_SIZE}px`;
      cells.style.height = `${field.rows * DITHER_CELL_SIZE}px`;

      // Static gap lines, drawn once per size at the capped device pixel ratio.
      gapCanvas.width = Math.max(1, Math.round(width * dpr));
      gapCanvas.height = Math.max(1, Math.round(height * dpr));
      gapContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      gapContext.fillStyle = PALETTE[0];
      gapContext.fill(field.gaps);

      draw();
    };

    const render = (now: number) => {
      animationFrame = requestAnimationFrame(render);
      // 4 ms tolerance absorbs rAF timestamp jitter so a 60 Hz display lands
      // on every second frame instead of occasionally skipping two.
      if (frameInterval && now - lastFrame < frameInterval - 4) return;
      lastFrame = now;
      currentTime = now / 1000;
      draw();
    };

    const sync = () => {
      const shouldRun = !reducedMotion && !occludedRef.current && !document.hidden;
      if (shouldRun && !running) {
        running = true;
        animationFrame = requestAnimationFrame(render);
      } else if (!shouldRun && running) {
        running = false;
        cancelAnimationFrame(animationFrame);
      }
    };
    syncRef.current = sync;

    // Size the element from a stable reference (the screen, or the viewport if
    // it is ever larger) instead of the live viewport. Scrollbars appearing
    // during page changes and mobile toolbars collapsing resize the viewport;
    // with a viewport-relative box each of those re-centred the grid and
    // visibly shifted the background. Anchored to the top-left with a
    // fixed-size box, the pattern stays put and only its visible edge moves.
    let refWidth = 0;
    let refHeight = 0;
    const layout = () => {
      const nextRefWidth = Math.max(window.screen.width || 0, window.innerWidth);
      const nextRefHeight = Math.max(window.screen.height || 0, window.innerHeight);
      if (nextRefWidth === refWidth && nextRefHeight === refHeight) return;
      refWidth = nextRefWidth;
      refHeight = nextRefHeight;
      root.style.left = `${-refWidth * PAINT_OVERSCAN}px`;
      root.style.top = `${-refHeight * PAINT_OVERSCAN}px`;
      root.style.width = `${refWidth * ELEMENT_SCALE}px`;
      root.style.height = `${refHeight * ELEMENT_SCALE}px`;
    };

    const observer = new ResizeObserver(resize);
    observer.observe(root);
    window.addEventListener("resize", layout, { passive: true });
    document.addEventListener("visibilitychange", sync);
    layout();
    resize();
    sync();

    return () => {
      running = false;
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      window.removeEventListener("resize", layout);
      document.removeEventListener("visibilitychange", sync);
      syncRef.current = () => {};
    };
  }, [contained, startAfterHero]);

  // Pause while an element marked data-dither-occluder (the opaque home hero)
  // fills the viewport — the grid underneath is invisible then. The last
  // frame stays painted, so it is ready the moment the hero starts to leave.
  useEffect(() => {
    const occluder = document.querySelector<HTMLElement>("[data-dither-occluder]");
    if (!occluder) {
      occludedRef.current = false;
      syncRef.current();
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        const root = entry.rootBounds;
        occludedRef.current =
          !!root &&
          entry.intersectionRect.height >= root.height - 1 &&
          entry.intersectionRect.width >= root.width - 1;
        syncRef.current();
      },
      { threshold: [0, 0.98, 0.99, 1] }
    );
    io.observe(occluder);
    return () => {
      io.disconnect();
      occludedRef.current = false;
      syncRef.current();
    };
  }, [pathname]);

  const overscan = `${PAINT_OVERSCAN * 100}%`;
  return (
    // The whole layer (base colour + cells + gaps) fades as one group, exactly
    // like the former single canvas did.
    <div
      ref={rootRef}
      aria-hidden="true"
      className="fixed z-0 pointer-events-none overflow-hidden opacity-[0.22] bg-[#110B0B]"
      style={{
        width: `${ELEMENT_SCALE * 100}%`,
        height: `${ELEMENT_SCALE * 100}%`,
        top: `-${overscan}`,
        left: `-${overscan}`,
      }}
    >
      <canvas ref={cellsRef} className="absolute" />
      <canvas ref={gapsRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}

export function DitherGridBackground({
  contained = false,
  startAfterHero = false,
}: {
  contained?: boolean;
  startAfterHero?: boolean;
}) {
  const pathname = usePathname();
  if (!contained && pathname === "/") return null;
  return (
    <DitherGridCanvas
      contained={contained}
      startAfterHero={startAfterHero}
    />
  );
}
