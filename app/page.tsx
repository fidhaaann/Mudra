"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import FadeContent from "@/components/ui/FadeContent";
import { getTeamColor } from "@/lib/team-colors";
import { TeamWordmark } from "@/components/ui/TeamNameLanguageTransition";
import { StandingsPodium, StandingsPodiumSkeleton } from "@/components/ui/StandingsPodium";
import { AwardWinners } from "@/components/ui/AwardWinners";
import { LeaderboardResponse, TeamLeaderboardEntry } from "@/types/leaderboard";

gsap.registerPlugin(ScrollTrigger);

const RippleDistortion = dynamic(
  () => import("@/components/ui/RippleDistortion"),
  { ssr: false }
);

export default function HomePage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  const loadLeaderboard = async () => {
    try {
      setLeaderboardLoading(true);
      setLeaderboardError(null);
      const response = await fetch("/api/leaderboard");
      if (!response.ok) throw new Error("Unable to load live standings.");
      setLeaderboard(await response.json() as LeaderboardResponse);
    } catch (error) {
      setLeaderboardError(error instanceof Error ? error.message : "Unable to load live standings.");
    } finally {
      setLeaderboardLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function fetchLeaderboard() {
      try {
        const response = await fetch("/api/leaderboard");
        if (!response.ok) throw new Error("Unable to load live standings.");
        const data = await response.json() as LeaderboardResponse;
        if (!ignore) {
          setLeaderboard(data);
          setLeaderboardError(null);
        }
      } catch (error) {
        if (!ignore) {
          setLeaderboardError(error instanceof Error ? error.message : "Unable to load live standings.");
        }
      } finally {
        if (!ignore) setLeaderboardLoading(false);
      }
    }
    fetchLeaderboard();
    return () => { ignore = true; };
  }, []);

  const standings: TeamLeaderboardEntry[] = leaderboard?.teams ?? [];
  // Standings are live once any event is completed OR the API reports points —
  // MANUAL overrides can set totals before any result exists. (Totals, ranks
  // and gaps are already effective values from /api/leaderboard.)
  const hasResults =
    (leaderboard?.completedEventCount ?? 0) > 0 || standings.some((t) => t.totalPoints !== 0);

  // ── FadeContent trigger ──────────────────────────────────────────────────
  const [heroReady, setHeroReady] = useState(false);

  useEffect(() => {
    // Fallback: if the loading screen never ran (hot reload / navigation),
    // reveal the hero after a short delay so content isn't stuck invisible.
    const fallback = setTimeout(() => setHeroReady(true), 800);

    const onDone = () => {
      clearTimeout(fallback);
      setHeroReady(true);
    };

    window.addEventListener("mudra:loading-done", onDone);
    return () => {
      window.removeEventListener("mudra:loading-done", onDone);
      clearTimeout(fallback);
    };
  }, []);

  // ── Hero → next-section scroll depth transition ──────────────────────────
  // The next section (standings) rises up from a slight yPercent offset.
  // Pure GSAP transforms — zero React state per frame, no layout properties.
  const heroRef     = useRef<HTMLElement>(null);
  const nextRef     = useRef<HTMLElement>(null);
  const nextContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Respect prefers-reduced-motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const hero = heroRef.current;
    const nextContent = nextContentRef.current;
    if (!hero || !nextContent) return;

    const isMobile = window.innerWidth < 768;

    // Initial state: set the next section slightly below its natural position.
    // Animate only the standings contents so the page section itself stays in place.
    gsap.set(nextContent, { yPercent: isMobile ? 2 : 4, willChange: "transform" });

    // Standings contents rise up to their natural position as hero scrolls away
    const nextTween = gsap.to(nextContent, {
      yPercent: 0,
      ease:     "none",
      scrollTrigger: {
        trigger:             hero,
        start:               "top top",
        end:                 "bottom top",
        scrub:               1.0,
        invalidateOnRefresh: true,
      },
    });

    return () => {
      nextTween.scrollTrigger?.kill();
      nextTween.kill();
      gsap.set(nextContent, { clearProps: "yPercent,willChange" });
    };
  }, []);

  return (
    <div className="flex flex-col w-full">
      {/* 1. HERO SECTION — exactly 1 complete viewport with full-screen WebGL ripples */}
      <section
        ref={heroRef}
        aria-label="MUDRA hero"
        // Opaque: lets the page dither background pause while this fills the viewport
        data-dither-occluder
        className="relative w-full h-svh overflow-hidden flex flex-col items-center justify-between border-b border-[#E3D28A]/30"
      >
        {/* Full Page Ripple Distortion Canvas */}
        <div className="absolute inset-0 z-0 w-full h-full">
          <RippleDistortion
            src="/images/hero-kerala.jpg"
            brushSize={150}
            strength={0.16}
            swirl={0.55}
            rings={4}
            grayscale={false}
            fade={2.8}
            dispersion={0.05}
            glint={0.12}
            tint="#E02E0B"
            tintAmount={0.18}
            highlightColor="#E3D28A"
            trigger="both"
            quality="medium"
            clickStrength={2.5}
          />
        </div>

        {/* Atmospheric Dark Overlay */}
        <div className="absolute inset-0 z-1 bg-linear-to-b from-[#110B0B]/65 via-[#110B0B]/35 to-[#110B0B]/80 pointer-events-none" />

        {/* Top Spacer for floating Navbar clearance */}
        <div className="h-[clamp(4.5rem,10svh,6.5rem)] shrink-0 pointer-events-none" />

        {/* Hero Content — Centered with dynamic dual-axis scaling */}
        <FadeContent
          trigger={heroReady}
          blur
          duration={700}
          ease="power2.out"
          delay={50}
          initialOpacity={0}
          className="relative z-2 flex flex-col items-center text-center px-4 sm:px-6 md:px-8 max-w-4xl mx-auto my-auto select-none w-full"
          style={{ opacity: 0 }}
        >
          {/* MUDRA logo (stacked dancer mark) */}
          <div className="relative flex justify-center w-full">
            <div className="w-[clamp(180px,min(72vw,40svh),340px)] md:w-[clamp(260px,min(46vw,46svh),440px)] flex justify-center">
              <Image
                src="/images/mudra-logo-dancer.png"
                alt="MUDRA"
                width={994}
                height={748}
                sizes="(max-width: 767px) min(72vw, 340px), 440px"
                loading="eager"
                fetchPriority="high"
                className="w-full h-auto max-h-[34svh] md:max-h-[42svh] object-contain"
                style={{
                  filter:
                    "drop-shadow(0 0 32px rgba(224,46,11,0.32)) drop-shadow(0 10px 25px rgba(0,0,0,0.95))",
                }}
              />
            </div>
          </div>

          {/* Cultural Tagline — Increased size */}
          <div className="mt-[clamp(0.6rem,2.2svh,1.5rem)] font-body text-[clamp(0.95rem,2.2svh,1.35rem)] text-[#E3D28A]/90 max-w-[clamp(300px,85vw,42rem)] leading-relaxed tracking-wide">
            <p>A thousand gestures, a thousand stories, one celebration of art.</p>
          </div>
        </FadeContent>

        {/* Bottom Spacer */}
        <div className="pb-6 shrink-0 pointer-events-none" />
      </section>

      {/* 2. POINTS TABLE / TEAM STANDINGS SECTION */}
      <section id="team-standings" ref={nextRef} className="relative z-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-6 w-full min-w-0">
        <div ref={nextContentRef} className="relative z-1 space-y-12">
        <div className="text-center space-y-2">
          <div className="font-display text-xs tracking-widest text-[#E02E0B] uppercase font-bold">
            MUDRA CHAMPIONSHIP
          </div>
          <h2 className="font-display font-black text-3xl sm:text-4xl text-[#E3D28A] tracking-wider uppercase">
            TEAM STANDINGS & POINTS
          </h2>
          <p className="font-body text-xs sm:text-sm text-[#E3D28A]/70 max-w-md mx-auto">
            Live points tally across all on-stage, off-stage, solo, duo, and group cultural events.
          </p>
        </div>

        {/* Championship podium (same leaderboard data; ranks from the API) */}
        {leaderboardLoading && <StandingsPodiumSkeleton />}

        {!leaderboardLoading && leaderboardError && (
          <div className="border border-[#E02E0B]/40 bg-[#5A0E0B]/10 p-6 text-center space-y-3">
            <p className="font-body text-xs sm:text-sm text-[#E3D28A]/80">{leaderboardError}</p>
            <button
              type="button"
              onClick={loadLeaderboard}
              className="inline-flex px-4 py-2 bg-[#E02E0B] text-[#E3D28A] font-display text-xs uppercase tracking-wider font-bold hover:bg-[#941108] transition-colors"
            >
              TRY AGAIN
            </button>
          </div>
        )}

        {!leaderboardLoading && !leaderboardError && (
          <StandingsPodium standings={standings} hasResults={hasResults} />
        )}

        {/* Points Breakdown Table */}
        {!leaderboardLoading && !leaderboardError && <div className="home-standings-table-scroll border border-[#E3D28A]/40 bg-[#110B0B] overflow-x-auto overflow-y-hidden min-w-0 shadow-xl shadow-black/60">
          <table className="min-w-full text-left font-body text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="relative border-b border-[#E3D28A]/30 font-display text-[11px] sm:text-xs tracking-wider text-[#E3D28A]/70 uppercase">
                <th className="relative z-10 py-3 px-3 sm:py-4 sm:px-5 whitespace-nowrap">POS</th>
                <th className="relative z-10 py-3 px-3 sm:py-4 sm:px-5 whitespace-nowrap">HOUSE / TEAM</th>
                <th className="relative z-10 py-3 px-3 sm:py-4 sm:px-5 text-right whitespace-nowrap">TOTAL</th>
                <th className="relative z-10 py-3 px-3 sm:py-4 sm:px-5 text-right whitespace-nowrap">1ST</th>
                <th className="relative z-10 py-3 px-3 sm:py-4 sm:px-5 text-right whitespace-nowrap">2ND</th>
                <th className="relative z-10 py-3 px-3 sm:py-4 sm:px-5 text-right whitespace-nowrap">3RD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3D28A]/15 font-body">
              {standings.map((standing) => (
                <tr key={standing.teamId} className="relative hover:bg-[#5A0E0B]/20 transition-colors">
                  <td className="relative py-3 px-3 sm:py-4 sm:px-5 font-display font-bold text-[#FFF7E6] whitespace-nowrap">
                    <span className="relative z-10">
                      {hasResults ? standing.rank : "—"}
                    </span>
                  </td>
                  <td
                    className="relative py-3 px-3 sm:py-4 sm:px-5 font-display font-bold tracking-wider text-sm sm:text-base whitespace-nowrap"
                    style={{ color: getTeamColor(standing.teamId) }}
                  >
                    <span className="relative z-10 inline-block">
                      <TeamWordmark teamId={standing.teamId} teamName={standing.teamName} />
                    </span>
                  </td>
                  <td className="relative py-3 px-3 sm:py-4 sm:px-5 text-right font-display font-bold text-[#FFF7E6] text-base sm:text-lg whitespace-nowrap">
                    <span className="relative z-10">
                      {hasResults ? standing.totalPoints : "—"}
                    </span>
                  </td>
                  <td className="relative py-3 px-3 sm:py-4 sm:px-5 text-right text-[#FFF7E6]/90 whitespace-nowrap">
                    <span className="relative z-10">
                      {hasResults ? standing.firstPlaceCount : "—"}
                    </span>
                  </td>
                  <td className="relative py-3 px-3 sm:py-4 sm:px-5 text-right text-[#FFF7E6]/90 whitespace-nowrap">
                    <span className="relative z-10">
                      {hasResults ? standing.secondPlaceCount : "—"}
                    </span>
                  </td>
                  <td className="relative py-3 px-3 sm:py-4 sm:px-5 text-right text-[#FFF7E6]/90 whitespace-nowrap">
                    <span className="relative z-10">
                      {hasResults ? standing.thirdPlaceCount : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}

        {!hasResults && (
          <p className="text-center font-body text-xs text-[#E3D28A]/50 italic">
            Standings will update automatically as verified results are published by the judging panel.
          </p>
        )}

        {/* Fallback copy: say so rather than presenting old standings as live */}
        {leaderboard?.dataStatus === "stale" && (
          <p role="status" className="text-center font-body text-xs text-[#EE8814] italic">
            Live updates are temporarily unavailable. Showing standings as of{" "}
            {new Date(leaderboard.lastUpdated).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}.
          </p>
        )}

        {/* Kalathilakam / Kalaprathibha — separate source (GET /api/awards) */}
        <AwardWinners />
        </div>
      </section>
    </div>
  );
}
