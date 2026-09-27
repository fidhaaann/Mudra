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

const subscribeToBrowser = () => () => {};

const getSafariSnapshot = () =>
  /Safari/.test(navigator.userAgent) &&
  !/Chrome|CriOS|FxiOS|EdgiOS|Android/.test(navigator.userAgent);

const getSafariServerSnapshot = () => false;

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
  const isSafari = useSyncExternalStore(
    subscribeToBrowser,
    getSafariSnapshot,
    getSafariServerSnapshot,
  );

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden [contain:paint] [isolation:isolate] ${className}`}
      style={{ opacity, minWidth: 0, minHeight: 0 }}
    >
      {isSafari ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 30%, ${hexToRgba(
              color,
              0.8,
            )} 0 1px, transparent 1.5px), repeating-linear-gradient(135deg, transparent 0 3px, ${hexToRgba(
              color,
              0.75,
            )} 3px 5px, transparent 5px 8px)`,
            backgroundSize: "12px 12px, 12px 12px",
            backgroundPosition: "0 0, 0 0",
          }}
          data-reduced-motion={reducedMotion}
        />
      ) : (
        <Dithering
          colorBack="#00000000"
          colorFront={color}
          minPixelRatio={1}
          speed={reducedMotion ? 0 : 0.22 + intensity * 0.3}
          shape="wave"
          type="4x4"
          pxSize={Math.round(2 + intensity * 2)}
          scale={1.03 + intensity * 0.12}
          style={{ display: "block", width: "100%", height: "100%" }}
        />
      )}

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
