"use client";

import React, { useState, useEffect, useRef } from "react";
import { getImageProps } from "next/image";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import FadeContent from "@/components/ui/FadeContent";
import { getTeamColor } from "@/lib/team-colors";
import { TeamWordmark } from "@/components/ui/TeamNameLanguageTransition";
import { AwardWinners } from "@/components/ui/AwardWinners";
import { LeaderboardResponse, TeamLeaderboardEntry } from "@/types/leaderboard";

gsap.registerPlugin(ScrollTrigger);

// Hero logo art direction: the stacked dancer logo on phones (< 768px, where
// the navbar collapses to its menu button), the wide wordmark above that.
// One <picture>, so each device downloads only the logo it shows.
const HERO_LOGO_WIDE = getImageProps({
  src: "/images/mudra-wordmark.png",
  alt: "MUDRA",
  width: 793,
  height: 228,
  sizes: "(max-width: 800px) 80vw, 640px",
}).props;
const HERO_LOGO_PHONE = getImageProps({
  src: "/images/mudra-logo-mobile.png",
  alt: "MUDRA",
  width: 994,
  height: 748,
  sizes: "min(72vw, 340px)",
  loading: "eager",
  fetchPriority: "high",
}).props;

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
  const hasResults = (leaderboard?.completedEventCount ?? 0) > 0;

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
          {/* MUDRA logo — stacked dancer logo on phones, wordmark from md up */}
          <div className="relative flex justify-center w-full">
            <div className="w-[clamp(180px,min(72vw,40svh),340px)] md:w-[clamp(240px,min(80vw,70svh),640px)] flex justify-center">
              <picture className="contents">
                <source
                  media="(min-width: 768px)"
                  srcSet={HERO_LOGO_WIDE.srcSet}
                  sizes={HERO_LOGO_WIDE.sizes}
                  width={HERO_LOGO_WIDE.width}
                  height={HERO_LOGO_WIDE.height}
                />
                {/* eslint-disable-next-line jsx-a11y/alt-text -- alt comes from getImageProps */}
                <img
                  {...HERO_LOGO_PHONE}
                  className="w-full h-auto aspect-994/748 md:aspect-793/228 max-h-[34svh] md:max-h-[clamp(70px,20svh,190px)] object-contain"
                  style={{
                    filter:
                      "drop-shadow(0 0 32px rgba(224,46,11,0.32)) drop-shadow(0 10px 25px rgba(0,0,0,0.95))",
                  }}
                />
              </picture>
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
      <section id="team-standings" ref={nextRef} className="relative z-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full min-w-0">
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

        {/* 4 Team Score Cards */}
        {leaderboardLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" aria-label="Loading standings">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="border border-[#E3D28A]/40 bg-[#110B0B] p-3 sm:p-5 text-center space-y-3 relative shadow-lg shadow-black/50 animate-pulse"
              >
                <div className="h-3 w-16 mx-auto bg-[#E02E0B]/20" />
                <div className="h-6 w-20 mx-auto bg-[#E3D28A]/10" />
                <div className="border-t border-[#E3D28A]/25 pt-3">
                  <div className="h-10 w-14 mx-auto bg-[#E3D28A]/10" />
                  <div className="h-2 w-20 mx-auto mt-2 bg-[#E3D28A]/10" />
                </div>
              </div>
            ))}
          </div>
        )}

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

        {!leaderboardLoading && !leaderboardError && <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {standings.map((standing, idx) => (
            <motion.div
              key={standing.teamId}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
              className="border border-[#E3D28A]/40 bg-[#110B0B] p-3 sm:p-5 text-center space-y-3 relative hover:border-[#E3D28A] transition-colors shadow-lg shadow-black/50"
            >
              <div className="relative z-10 space-y-3">
                <div className="font-display text-[10px] sm:text-xs tracking-widest text-[#E02E0B] uppercase font-bold">
                  {hasResults ? `RANK ${standing.rank}` : `TEAM 0${idx + 1}`}
                </div>

                <h3
                  className="font-display font-black text-lg sm:text-xl tracking-wider"
                  style={{ color: getTeamColor(standing.teamId) }}
                >
                  <TeamWordmark teamId={standing.teamId} teamName={standing.teamName} align="center" />
                </h3>

                <div className="border-t border-[#E3D28A]/25 pt-3">
                  <div className="font-display font-black text-3xl sm:text-4xl text-[#E3D28A]">
                    {hasResults ? standing.totalPoints : "—"}
                  </div>
                  <div className="font-body text-[10px] text-[#E3D28A]/50 tracking-wider uppercase mt-1">
                    TOTAL POINTS
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>}

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

        {/* Kalathilakam / Kalaprathibha — separate source (GET /api/awards) */}
        <AwardWinners />
        </div>
      </section>
    </div>
  );
}
