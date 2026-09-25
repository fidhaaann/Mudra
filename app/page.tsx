"use client";

import React from "react";
import { motion } from "framer-motion";
import { calculateTeamStandings } from "@/lib/scoring";

export default function HomePage() {
  const standings = calculateTeamStandings();
  const hasResults = standings.some((s) => s.totalPoints > 0);

  return (
    <div className="flex flex-col w-full">
      {/* 1. HERO SECTION — full viewport page */}
      <section className="h-[calc(100vh-96px)] flex flex-col items-center justify-center text-center px-6 sm:px-8 relative border-b border-[#E3D28A]/30">
        {/* Subtle Padayani Flame Motif */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="mb-6 select-none"
        >
          <svg
            width="56"
            height="56"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-[#E02E0B]"
          >
            <path
              d="M32 4L38 24L58 32L38 40L32 60L26 40L6 32L26 24L32 4Z"
              stroke="#E3D28A"
              strokeWidth="2"
              fill="#5A0E0B"
            />
            <circle cx="32" cy="32" r="5" fill="#E02E0B" />
          </svg>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="font-display font-black text-6xl sm:text-8xl lg:text-9xl tracking-[0.15em] text-[#E3D28A] uppercase leading-none"
        >
          MUDRA
        </motion.h1>

        {/* Year */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="font-display text-xl sm:text-2xl tracking-[0.3em] text-[#E02E0B] font-bold mt-3"
        >
          2026
        </motion.div>

        {/* Two short lines of cultural copy (placeholder) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-6 space-y-1 font-body text-xs sm:text-sm text-[#E3D28A]/80 max-w-md leading-relaxed"
        >
          <p>A sacred convergence of rhythm, theatrical tradition, and literary mastery.</p>
          <p>The grand stage of Kerala cultural heritage awaits.</p>
        </motion.div>
      </section>

      {/* 2. TEAM STANDINGS SECTION */}
      <section className="max-w-4xl mx-auto px-6 sm:px-8 py-20 w-full space-y-10">
        <div className="text-center space-y-1.5">
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-[#E3D28A] tracking-wider uppercase">
            TEAM STANDINGS
          </h2>
          <p className="font-body text-xs text-[#E3D28A]/60">
            Official points tally across all competitions
          </p>
        </div>

        {/* Compact Visual Boxes with Lighter Stroke */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {standings.map((standing, idx) => (
            <motion.div
              key={standing.team.id}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
              className="border border-[#E3D28A]/40 bg-[#110B0B] p-4 text-center space-y-3 relative hover:border-[#E3D28A] transition-colors"
            >
              <div className="font-display text-[10px] sm:text-xs tracking-widest text-[#E02E0B] uppercase">
                {hasResults ? `RANK ${standing.position}` : `TEAM 0${idx + 1}`}
              </div>

              <h3 className="font-display font-black text-lg sm:text-xl text-[#E3D28A] tracking-wider">
                {standing.team.name}
              </h3>

              <div className="border-t border-[#E3D28A]/25 pt-2.5">
                <div className="font-display font-black text-2xl sm:text-3xl text-[#E3D28A]">
                  {hasResults ? standing.totalPoints : "—"}
                </div>
                <div className="font-body text-[10px] text-[#E3D28A]/50 tracking-wider uppercase mt-0.5">
                  POINTS
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Simple Clean Table with Lighter Stroke */}
        <div className="border border-[#E3D28A]/40 bg-[#110B0B] overflow-x-auto">
          <table className="w-full text-left font-body text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="border-b border-[#E3D28A]/30 font-display text-[11px] sm:text-xs tracking-wider text-[#E3D28A]/70 uppercase">
                <th className="py-3.5 px-5">POSITION</th>
                <th className="py-3.5 px-5">TEAM</th>
                <th className="py-3.5 px-5 text-right">POINTS</th>
                <th className="py-3.5 px-5 text-right">1ST</th>
                <th className="py-3.5 px-5 text-right">2ND</th>
                <th className="py-3.5 px-5 text-right">3RD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3D28A]/15">
              {standings.map((standing) => (
                <tr key={standing.team.id} className="hover:bg-[#5A0E0B]/20 transition-colors">
                  <td className="py-3.5 px-5 font-display font-bold text-[#E02E0B]">
                    {hasResults ? `0${standing.position}` : "—"}
                  </td>
                  <td className="py-3.5 px-5 font-display font-bold text-[#E3D28A] tracking-wider">
                    {standing.team.name}
                  </td>
                  <td className="py-3.5 px-5 text-right font-display font-bold text-[#E3D28A]">
                    {hasResults ? standing.totalPoints : "—"}
                  </td>
                  <td className="py-3.5 px-5 text-right text-[#E3D28A]/70">
                    {hasResults ? standing.firstCount : "—"}
                  </td>
                  <td className="py-3.5 px-5 text-right text-[#E3D28A]/70">
                    {hasResults ? standing.secondCount : "—"}
                  </td>
                  <td className="py-3.5 px-5 text-right text-[#E3D28A]/70">
                    {hasResults ? standing.thirdCount : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!hasResults && (
          <p className="text-center font-body text-xs text-[#E3D28A]/50 italic">
            Results will be updated once official scores are ratified.
          </p>
        )}
      </section>
    </div>
  );
}
