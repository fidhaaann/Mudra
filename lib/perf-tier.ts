/**
 * Coarse device capability tier for scaling visual-effect workload.
 *
 * Uses real capability signals (CPU cores, device memory, Save-Data, coarse
 * pointer on small screens) rather than user-agent sniffing. Effects keep the
 * same look on every tier; lower tiers only render at a lower resolution or
 * frame rate.
 *
 *   high   → desktop / capable devices: full effect workload
 *   medium → phones/tablets or ≤4 cores: reduced render resolution
 *   low    → Save-Data, ≤2 cores, ≤2 GB, or ≤4 cores with ≤4 GB:
 *            reduced resolution + frame rate
 */

export type PerfTier = "high" | "medium" | "low";

interface NavigatorWithHints extends Navigator {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

let cached: PerfTier | null = null;

export function getPerfTier(): PerfTier {
  if (cached) return cached;
  if (typeof window === "undefined") return "high";

  const nav = navigator as NavigatorWithHints;
  const cores = nav.hardwareConcurrency || 4;
  const memory = nav.deviceMemory; // Chromium only; undefined elsewhere
  const saveData = nav.connection?.saveData === true;
  const handheld =
    window.matchMedia("(pointer: coarse)").matches &&
    Math.min(window.screen.width, window.screen.height) < 820;

  // "low" needs a clear signal: Safari exposes no deviceMemory and may report
  // a reduced core count, so cores alone never demote a device below medium.
  if (
    saveData ||
    cores <= 2 ||
    (memory !== undefined && memory <= 2) ||
    (cores <= 4 && memory !== undefined && memory <= 4)
  ) {
    cached = "low";
  } else if (handheld || cores <= 4 || (memory !== undefined && memory <= 4)) {
    cached = "medium";
  } else {
    cached = "high";
  }
  return cached;
}

/** Device-pixel-ratio ceiling for full-screen effects, per tier. */
export function effectDprCap(tier: PerfTier = getPerfTier()): number {
  return tier === "high" ? 1.5 : tier === "medium" ? 1.25 : 1;
}
