"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { AwardsResponse } from "@/types/awards";

/**
 * Kalathilakam / Kalaprathibha winners, exactly as volunteers enter them in
 * AWARDS!A2:B2 (served by GET /api/awards). Nothing here is calculated:
 * blank names render "Not announced yet", a failed request "Unavailable".
 *
 * Every state renders the same two-cell frame with a one-line minimum name
 * height, so the section does not shift when the response arrives.
 */

type AwardsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: AwardsResponse };

const AWARDS = [
  { key: "kalathilakam", label: "KALATHILAKAM" },
  { key: "kalaprathibha", label: "KALAPRATHIBHA" },
] as const;

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

      <dl
        className="grid grid-cols-1 sm:grid-cols-2 border border-[#E3D28A]/30 bg-[#110B0B] divide-y sm:divide-y-0 sm:divide-x divide-[#E3D28A]/20"
        aria-busy={state.status === "loading"}
      >
        {AWARDS.map(({ key, label }) => {
          const name = state.status === "ready" ? state.data[key] : null;
          return (
            <div key={key} className="min-w-0 px-4 py-4 sm:px-6 sm:py-5 space-y-1.5">
              <dt className="font-display text-[10px] sm:text-xs tracking-widest text-[#E02E0B] uppercase font-bold">
                {label}
              </dt>
              {/* min-h = one line of the name size, shared by every state */}
              <dd className="font-display font-bold text-lg sm:text-xl leading-snug min-h-[1.375em] text-[#E3D28A] wrap-anywhere">
                {state.status === "loading" ? (
                  <span
                    aria-hidden="true"
                    className="block h-[1.375em] w-40 max-w-full bg-[#E3D28A]/10 animate-pulse motion-reduce:animate-none"
                  />
                ) : name ? (
                  name
                ) : (
                  <span className="font-body font-normal text-sm italic text-[#E3D28A]/50">
                    {state.status === "error" ? "Unavailable right now" : "Not announced yet"}
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
