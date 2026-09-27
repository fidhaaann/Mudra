"use client";

import { Dithering } from "@paper-design/shaders-react";
import { useSyncExternalStore } from "react";

interface NeonDitherProps {
  color: string;
  intensity?: number;
  opacity?: number;
  className?: string;
}

const subscribeToReducedMotion = (callback: () => void) => {
  const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
};

const getReducedMotionSnapshot = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const getReducedMotionServerSnapshot = () => false;

export function NeonDither({
  color,
  intensity = 0.5,
  opacity = 1,
  className = "",
}: NeonDitherProps) {
  const reducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ opacity }}
    >
      <Dithering
        colorBack="#00000000"
        colorFront={color}
        speed={reducedMotion ? 0 : 0.22 + intensity * 0.3}
        shape="wave"
        type="4x4"
        pxSize={Math.round(2 + intensity * 2)}
        scale={1.03 + intensity * 0.12}
        style={{ width: "100%", height: "100%" }}
      />

      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 40%, ${hexToRgba(
            color,
            0.16,
          )}, transparent 70%)`,
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at center, transparent 55%, rgba(0,0,0,0.15) 100%)",
        }}
      />
    </div>
  );
}

function hexToRgba(hex: string, alpha: number) {
  const value = parseInt(hex.replace("#", ""), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
