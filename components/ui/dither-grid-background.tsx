"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

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

function interpolateColor(amount: number): string {
  const scaled = Math.max(0, Math.min(PALETTE.length - 1, amount));
  const index = Math.min(PALETTE.length - 2, Math.floor(scaled));
  const remainder = scaled - index;
  const from = hexToRgb(PALETTE[index]);
  const to = hexToRgb(PALETTE[index + 1]);
  const rgb = from.map((channel, i) =>
    Math.round(channel + (to[i] - channel) * remainder)
  );
  return `rgb(${rgb.join(",")})`;
}

function drawDither(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number
) {
  context.clearRect(0, 0, width, height);
  context.fillStyle = PALETTE[0];
  context.fillRect(0, 0, width, height);

  const pixelCols = Math.ceil(width / DITHER_CELL_SIZE);
  const pixelRows = Math.ceil(height / DITHER_CELL_SIZE);
  const ph = time * 0.71;
  const amt = 0.6;
  const dir = 1;
  const spin = ph * dir;
  const modulation = Math.sin(ph * 0.9 * dir) * 0.5 * amt;
  const cellWidth = DITHER_CELL_SIZE;
  const cellHeight = DITHER_CELL_SIZE;
  const subPixelWidth = cellWidth / 4;
  const subPixelHeight = cellHeight / 4;
  const angle = (CONFIG.pixelAngle * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  for (let row = 0; row < pixelRows; row++) {
    for (let column = 0; column < pixelCols; column++) {
      const baseX = (column + 0.5) / pixelCols;
      const baseY = (row + 0.5) / pixelRows;
      const centeredX = baseX - CONFIG.centerX / 100;
      const centeredY = baseY - CONFIG.centerY / 100;
      const rotatedX = centeredX * cos - centeredY * sin;
      const rotatedY = centeredX * sin + centeredY * cos;
      const distance = Math.sqrt(centeredX ** 2 + centeredY ** 2);
      const wave = Math.sin(
        rotatedX * CONFIG.scale * 0.12 +
          Math.sin(rotatedY * CONFIG.wave + spin) * (CONFIG.distortion / 10) +
          spin
      );
      const arch = Math.max(
        0,
        1 -
          Math.abs(rotatedX) / (CONFIG.archWidth / 100) -
          Math.max(0, rotatedY + CONFIG.archBase / 100 - 1) *
            (CONFIG.archHeight / 25)
      );
      const grain = (hash(column, row) - 0.5) * (CONFIG.grain / 1000);
      const vignette = Math.max(0, 1 - distance * (CONFIG.vignette / 1.5));
      const baseTone = 0.35 + wave * 0.12 + arch * 0.18 + vignette * 0.1 + grain;
      const tone = Math.max(
        0,
        Math.min(PALETTE.length - 1, baseTone * (PALETTE.length - 1) + modulation)
      );

      for (let subRow = 0; subRow < 4; subRow++) {
        for (let subColumn = 0; subColumn < 4; subColumn++) {
          const threshold =
            (BAYER_4X4[subRow][subColumn] + 0.5) / 16;
          const diagonal = (subColumn - subRow) * 0.01;
          const ditherTone = tone + (threshold - 0.5) * (CONFIG.pixelDither / 100) + diagonal;
          const x = column * cellWidth + subColumn * subPixelWidth;
          const y = row * cellHeight + subRow * subPixelHeight;
          const gap = Math.min(
            CONFIG.pixelGap / 10,
            subPixelWidth * 0.3,
            subPixelHeight * 0.3
          );
          context.fillStyle = interpolateColor(ditherTone);
          context.fillRect(
            x + gap,
            y + gap,
            Math.max(1, subPixelWidth - gap * 2),
            Math.max(1, subPixelHeight - gap * 2)
          );
        }
      }
    }
  }
}

function DitherGridCanvas({
  contained = false,
  startAfterHero = false,
}: {
  contained?: boolean;
  startAfterHero?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let currentTime = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const bounds = contained ? canvas.parentElement?.getBoundingClientRect() : undefined;
      width = bounds?.width ?? window.innerWidth;
      height = Math.max(1, bounds?.height ?? window.innerHeight);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawDither(context, width, height, currentTime);
    };

    const render = (now: number) => {
      currentTime = now / 1000;
      drawDither(context, width, height, currentTime);
      animationFrame = requestAnimationFrame(render);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(
      contained ? canvas.parentElement ?? document.documentElement : document.documentElement
    );
    window.addEventListener("resize", resize, { passive: true });
    resize();

    if (!reducedMotion) {
      animationFrame = requestAnimationFrame(render);
    }

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [contained, startAfterHero]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={
        contained
          ? "absolute inset-0 z-0 w-full pointer-events-none opacity-[0.22]"
          : "fixed inset-0 z-0 h-dvh w-dvw pointer-events-none opacity-[0.22]"
      }
      style={{ top: 0 }}
    />
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
