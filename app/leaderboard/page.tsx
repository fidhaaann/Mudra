"use client";

import React from "react";
import { motion } from "framer-motion";
import { calculateTeamStandings } from "@/lib/scoring";

export default function LeaderboardPage() {
  const standings = calculateTeamStandings();
  const hasResults = standings.some((s) => s.totalPoints > 0);
  const maxPoints = Math.max(...standings.map((s) => s.totalPoints), 1);

  return (
    <div className="max-w-4xl mx-auto px-6 sm:px-8 py-12 space-y-12">
      {/* Title */}
      <div className="space-y-1.5">
        <h1 className="font-display font-black text-4xl sm:text-5xl text-[#E3D28A] tracking-wider uppercase">
          LEADERBOARD
        </h1>
        <p className="font-body text-xs sm:text-sm text-[#E3D28A]/70">
          Official championship standings for the four houses of Mudra 2026.
        </p>
      </div>

      {/* 1. ANIMATED STANDINGS VISUALIZATION WITH LIGHTER STROKE */}
      <div className="space-y-3">
        {standings.map((standing, index) => {
          const widthPercentage = hasResults
            ? Math.max((standing.totalPoints / maxPoints) * 100, 8)
            : 0;

          return (
            <motion.div
              key={standing.team.id}
              layout
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="border border-[#E3D28A]/40 bg-[#110B0B] p-4 sm:p-5 space-y-2.5 hover:border-[#E3D28A] transition-colors"
            >
              <div className="flex items-baseline justify-between font-display">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-[#E02E0B]">
                    {hasResults ? `0${standing.position}` : `0${index + 1}`}
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-[#E3D28A] tracking-wider">
                    {standing.team.name}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl sm:text-2xl font-bold text-[#E3D28A]">
                    {hasResults ? standing.totalPoints : "—"}
                  </span>
                  {hasResults && (
                    <span className="text-[10px] text-[#E3D28A]/60 ml-1">PTS</span>
                  )}
                </div>
              </div>

              {/* Graphical Progress Bar */}
              <div className="w-full h-1.5 bg-[#5A0E0B]/30 overflow-hidden">
                <motion.div
                  className="h-full bg-[#E02E0B]"
                  initial={{ width: 0 }}
                  animate={{ width: `${widthPercentage}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* 2. SIMPLE TABLE WITH LIGHTER STROKE */}
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
          <tbody className="divide-y divide-[#E3D28A]/15 font-body">
            {standings.map((standing) => (
              <tr key={standing.team.id} className="hover:bg-[#5A0E0B]/20 transition-colors">
                <td className="py-3 px-5 font-display font-bold text-[#E02E0B]">
                  {hasResults ? `0${standing.position}` : "—"}
                </td>
                <td className="py-3 px-5 font-display font-bold text-[#E3D28A] tracking-wider">
                  {standing.team.name}
                </td>
                <td className="py-3 px-5 text-right font-display font-bold text-[#E3D28A]">
                  {hasResults ? standing.totalPoints : "—"}
                </td>
                <td className="py-3 px-5 text-right text-[#E3D28A]/70">
                  {hasResults ? standing.firstCount : "—"}
                </td>
                <td className="py-3 px-5 text-right text-[#E3D28A]/70">
                  {hasResults ? standing.secondCount : "—"}
                </td>
                <td className="py-3 px-5 text-right text-[#E3D28A]/70">
                  {hasResults ? standing.thirdCount : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!hasResults && (
        <p className="text-center font-body text-xs text-[#E3D28A]/50 italic">
          Standings will automatically update as results are recorded.
        </p>
      )}
    </div>
  );
}
