"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { getTeamColor } from "@/lib/team-colors";
import { TeamWordmark } from "@/components/ui/TeamNameLanguageTransition";
import type { TeamLeaderboardEntry } from "@/types/leaderboard";

/**
 * Championship podium for the Home page standings.
 *
 * Composition: three joined pillars (2nd left, 1st centre and tallest, 3rd
 * right), each with a flat lighter top face for depth and its rank numeral on
 * the front; rank label, team wordmark and a points chip sit above each pillar,
 * with a laurel wreath (kliwir art, Flaticon) above the leader.
 * Only the top three are shown; 4th place and below are not displayed here.
 *
 * Purely presentational — the leaderboard API is the source of truth:
 *  - Entries are shown in the order the API returns them (already ranked);
 *    the first three take the podium slots (centre, left, right). No frontend
 *    sorting or tie-breaking.
 *  - Labels and pillar heights come from each entry's backend `rank`, so tied
 *    teams share a label and height (marked "TIED").
 *  - Before there are any standings (`hasResults` false: no completed event
 *    and no MANUAL totals) every team shares rank 1 with 0 points; the podium
 *    then shows neutral, equal pillars and "—" instead of claiming placings.
 *
 * DOM order is rank order (an <ol>), so screen readers read 1st → 3rd; CSS
 * `order` places 2nd left and 3rd right. Rank is always spelled out in text;
 * the big numerals are decorative duplicates.
 */

const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "TH" : (["TH", "ST", "ND", "RD"][n % 10] ?? "TH");
  return `${n}${s}`;
};

// Pillar heights by backend rank (1st tallest); neutral height before results.
const PILLAR_HEIGHT: Record<"1" | "2" | "3" | "neutral", string> = {
  "1": "h-36 sm:h-52",
  "2": "h-24 sm:h-36",
  "3": "h-[4.5rem] sm:h-28",
  neutral: "h-24 sm:h-36",
};

// Visual slot for the n-th entry in API order: centre, left, right.
const SLOT_ORDER = ["order-2", "order-1", "order-3"];

// Flat top face of a pillar (trapezoid), drawn above the front face.
const CAP = "absolute inset-x-0 -top-2.5 sm:-top-3 h-2.5 sm:h-3 [clip-path:polygon(7%_0,93%_0,100%_100%,0_100%)]";

function PointsChip({ points, strong }: { points: string; strong?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 border px-2 py-0.5 font-display font-black tabular-nums leading-none",
        strong
          ? "border-[#E02E0B]/60 bg-[#5A0E0B]/40 text-base sm:text-2xl text-[#E3D28A]"
          : "border-[#E3D28A]/25 bg-[#110B0B]/80 text-sm sm:text-xl text-[#E3D28A]"
      )}
    >
      {points}
      <span className="font-body text-[8px] sm:text-[10px] font-normal uppercase tracking-wider text-[#E3D28A]/55">
        pts
      </span>
    </span>
  );
}

export function StandingsPodium({
  standings,
  hasResults,
}: {
  standings: TeamLeaderboardEntry[];
  hasResults: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const podium = standings.slice(0, 3);
  // Ties are checked against every team, so a 3rd place tied with 4th is
  // still labelled "TIED" even though 4th itself isn't shown.
  const isTied = (entry: TeamLeaderboardEntry) =>
    standings.filter((s) => s.rank === entry.rank).length > 1;
  const points = (entry: TeamLeaderboardEntry) => (hasResults ? String(entry.totalPoints) : "—");

  const enter = (idx: number) =>
    reducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 15 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true },
          transition: { duration: 0.4, delay: idx * 0.08 },
        };

  return (
    <div className="mx-auto w-full max-w-xl min-w-0">
      <ol aria-label="Team standings" className="grid grid-cols-3 items-end">
        {podium.map((entry, idx) => {
          const pillar = hasResults
            ? PILLAR_HEIGHT[String(Math.min(entry.rank, 3)) as "1" | "2" | "3"]
            : PILLAR_HEIGHT.neutral;
          const first = hasResults && entry.rank === 1;
          return (
            <motion.li
              key={entry.teamId}
              layout={!reducedMotion}
              {...enter(idx)}
              className={cn("flex min-w-0 flex-col items-center", SLOT_ORDER[idx])}
            >
              {/* Rank label, team and points above the pillar */}
              <div className="mb-4 sm:mb-5 flex w-full min-w-0 flex-col items-center gap-1.5 sm:gap-2 px-1 text-center">
                {first && (
                  // Laurel by kliwir art (Flaticon) — decorative; rank is spelled out below
                  <Image
                    src="/images/laurel.png"
                    alt=""
                    aria-hidden="true"
                    width={160}
                    height={146}
                    sizes="48px"
                    className="h-auto w-8 sm:w-12"
                  />
                )}
                <div className="font-display text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#E02E0B]">
                  {hasResults ? ordinal(entry.rank) : "—"}
                  {hasResults && isTied(entry) && <span className="ml-1 text-[#E3D28A]/50">TIED</span>}
                </div>
                {/* pt: room for Malayalam marks, which overhang the wordmark box */}
                <div
                  className={cn(
                    "pt-2 sm:pt-3 font-display font-black tracking-wider",
                    first ? "text-base sm:text-2xl" : "text-sm sm:text-xl"
                  )}
                  style={{ color: getTeamColor(entry.teamId) }}
                >
                  <TeamWordmark teamId={entry.teamId} teamName={entry.teamName} align="center" />
                </div>
                <PointsChip points={points(entry)} strong={first} />
              </div>

              {/* Pillar: flat top face + front face with the rank numeral */}
              <div
                aria-hidden="true"
                className={cn(
                  "relative w-full transition-[height] duration-500 motion-reduce:transition-none",
                  pillar
                )}
              >
                <span className={cn(CAP, first ? "bg-[#5A0E0B]" : "bg-[#2B1B17]")} />
                <div
                  className={cn(
                    "flex h-full w-full items-start justify-center border-x border-t pt-3 sm:pt-5",
                    first
                      ? "border-[#E02E0B]/70 bg-[#1F0F0C]"
                      : "border-[#E3D28A]/20 bg-[#171010]"
                  )}
                >
                  {hasResults && (
                    <span
                      className={cn(
                        "font-display font-black leading-none",
                        first ? "text-5xl sm:text-7xl text-[#E3D28A]" : "text-4xl sm:text-6xl text-[#E3D28A]/70"
                      )}
                    >
                      {entry.rank}
                    </span>
                  )}
                </div>
              </div>
            </motion.li>
          );
        })}
      </ol>

      {/* Podium floor */}
      <div aria-hidden="true" className="h-1 bg-[#E3D28A]/40" />
    </div>
  );
}

/** Loading placeholder with the podium's silhouette (no layout jump, no scores). */
export function StandingsPodiumSkeleton() {
  return (
    <div className="mx-auto w-full max-w-xl animate-pulse motion-reduce:animate-none" aria-label="Loading standings">
      <div className="grid grid-cols-3 items-end" aria-hidden="true">
        {[PILLAR_HEIGHT["2"], PILLAR_HEIGHT["1"], PILLAR_HEIGHT["3"]].map((h, i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="mb-5 flex w-full flex-col items-center gap-2">
              <div className="h-2.5 w-8 bg-[#E02E0B]/20" />
              <div className="h-5 w-16 bg-[#E3D28A]/10" />
              <div className="h-6 w-14 bg-[#E3D28A]/10" />
            </div>
            <div className={cn("relative w-full", h)}>
              <span className={cn(CAP, "bg-[#2B1B17]/60")} />
              <div className="h-full w-full border-x border-t border-[#E3D28A]/10 bg-[#171010]" />
            </div>
          </div>
        ))}
      </div>
      <div className="h-1 bg-[#E3D28A]/20" />
    </div>
  );
}
