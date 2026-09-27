"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { calculateTeamStandings } from "@/lib/scoring";
import FadeContent from "@/components/ui/FadeContent";

gsap.registerPlugin(ScrollTrigger);

const RippleDistortion = dynamic(
  () => import("@/components/ui/RippleDistortion"),
  { ssr: false }
);

export default function HomePage() {
  const standings = calculateTeamStandings();
  const hasResults = standings.some((s) => s.totalPoints > 0);

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
  // Hero section subtly scales down and drifts upward as the user scrolls.
  // The next section (standings) rises up from a slight yPercent offset.
  // Pure GSAP transforms — zero React state per frame, no layout properties.
  const heroRef     = useRef<HTMLElement>(null);
  const nextRef     = useRef<HTMLElement>(null);

  useEffect(() => {
    // Respect prefers-reduced-motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const hero = heroRef.current;
    const next = nextRef.current;
    if (!hero || !next) return;

    const isMobile = window.innerWidth < 768;

    // Initial state: set the next section slightly below its natural position.
    // willChange promotes these elements to their own compositor layers.
    gsap.set(hero, { willChange: "transform" });
    gsap.set(next, { yPercent: isMobile ? 2 : 4, willChange: "transform" });

    // Hero scrolls away: scales very gently down and drifts up
    const heroTween = gsap.to(hero, {
      scale:    isMobile ? 0.98 : 0.96,
      yPercent: isMobile ? -3  : -5,
      ease:     "none",
      scrollTrigger: {
        trigger:             hero,
        start:               "top top",
        end:                 "bottom top",
        scrub:               1.4,
        invalidateOnRefresh: true,
      },
    });

    // Next section rises up to its natural position as hero scrolls away
    const nextTween = gsap.to(next, {
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
      heroTween.scrollTrigger?.kill();
      heroTween.kill();
      nextTween.scrollTrigger?.kill();
      nextTween.kill();
      gsap.set(hero, { clearProps: "scale,yPercent,willChange" });
      gsap.set(next, { clearProps: "yPercent,willChange" });
    };
  }, []);

  return (
    <div className="flex flex-col w-full">
      {/* 1. HERO SECTION — exactly 1 complete viewport with full-screen WebGL ripples */}
      <section
        ref={heroRef}
        aria-label="MUDRA 2026 hero"
        className="relative w-full h-screen h-[100svh] h-[100dvh] overflow-hidden flex flex-col items-center justify-between border-b border-[#E3D28A]/30"
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
        <div className="absolute inset-0 z-[1] bg-gradient-to-b from-[#110B0B]/65 via-[#110B0B]/35 to-[#110B0B]/80 pointer-events-none" />

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
          className="relative z-[2] flex flex-col items-center text-center px-4 sm:px-6 md:px-8 max-w-4xl mx-auto my-auto select-none w-full"
          style={{ opacity: 0 }}
        >
          {/* Prominent Mudra Logo Emblem — increased size */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex justify-center w-full"
          >
            <div className="w-[clamp(170px,min(60vw,38svh),460px)] flex justify-center">
              <Image
                src="/images/mudra-logo.png"
                alt="MUDRA 2026 Emblem"
                width={585}
                height={511}
                priority
                loading="eager"
                className="w-full h-auto max-h-[clamp(160px,36svh,420px)] object-contain filter drop-shadow-[0_0_50px_rgba(224,46,11,0.6)] drop-shadow-[0_10px_25px_rgba(0,0,0,0.95)]"
              />
            </div>
          </motion.div>

          {/* Year — Increased size */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="font-display text-[clamp(2rem,5.5svh,4.25rem)] font-black tracking-[clamp(0.25em,1.5vw,0.45em)] text-[#E3D28A] mt-[clamp(0.3rem,1.5svh,0.9rem)]"
          >
            2026
          </motion.div>

          {/* Cultural Tagline — Increased size */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="mt-[clamp(0.6rem,2.2svh,1.5rem)] font-body text-[clamp(0.95rem,2.2svh,1.35rem)] text-[#E3D28A]/90 max-w-[clamp(300px,85vw,42rem)] leading-relaxed tracking-wide"
          >
            <p>A thousand gestures, a thousand stories, one celebration of art.</p>
          </motion.div>
        </FadeContent>

        {/* Bottom Spacer */}
        <div className="pb-6 shrink-0 pointer-events-none" />
      </section>

      {/* 2. POINTS TABLE / TEAM STANDINGS SECTION */}
      <section ref={nextRef} className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full min-w-0 space-y-12">
        <div className="text-center space-y-2">
          <div className="font-display text-xs tracking-widest text-[#E02E0B] uppercase font-bold">
            MUDRA 2026 CHAMPIONSHIP
          </div>
          <h2 className="font-display font-black text-3xl sm:text-4xl text-[#E3D28A] tracking-wider uppercase">
            TEAM STANDINGS & POINTS
          </h2>
          <p className="font-body text-xs sm:text-sm text-[#E3D28A]/70 max-w-md mx-auto">
            Live points tally across all on-stage, off-stage, solo, duo, and group cultural events.
          </p>
        </div>

        {/* 4 Team Score Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {standings.map((standing, idx) => (
            <motion.div
              key={standing.team.id}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
              className="border border-[#E3D28A]/40 bg-[#110B0B] p-3 sm:p-5 text-center space-y-3 relative hover:border-[#E3D28A] transition-colors shadow-lg shadow-black/50"
            >
              <div className="font-display text-[10px] sm:text-xs tracking-widest text-[#E02E0B] uppercase font-bold">
                {hasResults ? `RANK 0${standing.position}` : `TEAM 0${idx + 1}`}
              </div>

              <h3 className="font-display font-black text-lg sm:text-xl text-[#E3D28A] tracking-wider">
                {standing.team.name}
              </h3>

              <div className="border-t border-[#E3D28A]/25 pt-3">
                <div className="font-display font-black text-3xl sm:text-4xl text-[#E3D28A]">
                  {hasResults ? standing.totalPoints : "—"}
                </div>
                <div className="font-body text-[10px] text-[#E3D28A]/50 tracking-wider uppercase mt-1">
                  TOTAL POINTS
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Points Breakdown Table */}
        <div className="border border-[#E3D28A]/40 bg-[#110B0B] overflow-x-auto min-w-0 shadow-xl shadow-black/60">
          <table className="min-w-full text-left font-body text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="border-b border-[#E3D28A]/30 font-display text-[11px] sm:text-xs tracking-wider text-[#E3D28A]/70 uppercase bg-[#5A0E0B]/20">
                <th className="py-3 px-3 sm:py-4 sm:px-5 whitespace-nowrap">POS</th>
                <th className="py-3 px-3 sm:py-4 sm:px-5 whitespace-nowrap">HOUSE / TEAM</th>
                <th className="py-3 px-3 sm:py-4 sm:px-5 text-right whitespace-nowrap">TOTAL</th>
                <th className="py-3 px-3 sm:py-4 sm:px-5 text-right whitespace-nowrap">1ST</th>
                <th className="py-3 px-3 sm:py-4 sm:px-5 text-right whitespace-nowrap">2ND</th>
                <th className="py-3 px-3 sm:py-4 sm:px-5 text-right whitespace-nowrap">3RD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3D28A]/15 font-body">
              {standings.map((standing) => (
                <tr key={standing.team.id} className="hover:bg-[#5A0E0B]/20 transition-colors">
                  <td className="py-3 px-3 sm:py-4 sm:px-5 font-display font-bold text-[#E02E0B] whitespace-nowrap">
                    {hasResults ? `0${standing.position}` : "—"}
                  </td>
                  <td className="py-3 px-3 sm:py-4 sm:px-5 font-display font-bold text-[#E3D28A] tracking-wider text-sm sm:text-base whitespace-nowrap">
                    {standing.team.name}
                  </td>
                  <td className="py-3 px-3 sm:py-4 sm:px-5 text-right font-display font-bold text-[#E3D28A] text-base sm:text-lg whitespace-nowrap">
                    {hasResults ? standing.totalPoints : "—"}
                  </td>
                  <td className="py-3 px-3 sm:py-4 sm:px-5 text-right text-[#E3D28A]/80 whitespace-nowrap">
                    {hasResults ? standing.firstCount : "—"}
                  </td>
                  <td className="py-3 px-3 sm:py-4 sm:px-5 text-right text-[#E3D28A]/80 whitespace-nowrap">
                    {hasResults ? standing.secondCount : "—"}
                  </td>
                  <td className="py-3 px-3 sm:py-4 sm:px-5 text-right text-[#E3D28A]/80 whitespace-nowrap">
                    {hasResults ? standing.thirdCount : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!hasResults && (
          <p className="text-center font-body text-xs text-[#E3D28A]/50 italic">
            Standings will update automatically as verified results are published by the judging panel.
          </p>
        )}
      </section>
    </div>
  );
}

