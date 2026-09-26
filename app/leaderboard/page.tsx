"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  useId,
} from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { TeamLeaderboardEntry, LeaderboardResponse } from "@/types/leaderboard";

// ─── constants ───────────────────────────────────────────────────────────────

const COLORS = {
  bg: "#110B0B",
  gold: "#E3D28A",
  fire: "#E02E0B",
  darkRed: "#5A0E0B",
  goldDim: "rgba(227,210,138,0.18)",
  goldFaint: "rgba(227,210,138,0.06)",
} as const;

// Per-team accent colours — all from the MUDRA palette, no gradients
const TEAM_COLORS: Record<string, string> = {
  raaga: "#E02E0B",   // fire
  agni: "#E3D28A",    // gold
  tarang: "#EE8814",  // highlight amber
  utsav: "#C0A96E",   // muted gold
};

function teamColor(teamId: string): string {
  return TEAM_COLORS[teamId.toLowerCase()] ?? COLORS.gold;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatRank(rank: number): string {
  return rank < 10 ? `0${rank}` : `${rank}`;
}

function fmtOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

// ─── SVG bar chart ───────────────────────────────────────────────────────────

interface ChartProps {
  teams: TeamLeaderboardEntry[];
  hasResults: boolean;
}

function TeamBarChart({ teams, hasResults }: ChartProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    team: TeamLeaderboardEntry;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const uid = useId();

  // Respect prefers-reduced-motion
  const reducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  const maxPts = useMemo(
    () => Math.max(...teams.map((t) => t.totalPoints), 1),
    [teams]
  );

  // Chart geometry
  const PAD_LEFT = 44;
  const PAD_RIGHT = 16;
  const PAD_TOP = 20;
  const PAD_BOT = 52;
  const HEIGHT = 240;
  const chartH = HEIGHT - PAD_TOP - PAD_BOT;

  // Y-axis tick values (4 ticks, rounded nicely)
  const yTicks = useMemo(() => {
    if (!hasResults) return [0];
    const step = Math.ceil(maxPts / 4 / 5) * 5 || 1;
    return [0, step, step * 2, step * 3, step * 4].filter((v) => v <= maxPts + step);
  }, [hasResults, maxPts]);

  function barHeight(pts: number): number {
    if (!hasResults || maxPts === 0) return 0;
    return (pts / maxPts) * chartH;
  }

  // Bar tap / hover handlers — work on both mouse and touch
  function handleEnter(team: TeamLeaderboardEntry, barCx: number) {
    setHovered(team.teamId);
    // Tooltip position in SVG units — we'll translate to %-based in JSX
    setTooltip({ x: barCx, y: 0, team });
  }
  function handleLeave() {
    setHovered(null);
    setTooltip(null);
  }

  return (
    <div
      className="relative w-full select-none"
      aria-label="Team points bar chart"
      role="img"
    >
      {/* Tooltip — absolutely positioned over chart */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10"
          style={{
            // Position relative to SVG width; center on hovered bar
            left: `clamp(8px, calc(${(tooltip.x / 100) * 100}% - 72px), calc(100% - 152px))`,
            top: "10px",
          }}
        >
          <div
            className="border border-[#E3D28A]/60 bg-[#110B0B] px-4 py-3 space-y-1 min-w-[140px]"
            role="tooltip"
          >
            <div className="font-display font-black text-sm tracking-wider"
              style={{ color: teamColor(tooltip.team.teamId) }}>
              {tooltip.team.teamName}
            </div>
            <div className="font-display text-[10px] tracking-widest text-[#E02E0B] uppercase">
              {hasResults ? fmtOrdinal(tooltip.team.rank) + " place" : "No data yet"}
            </div>
            <div className="border-t border-[#E3D28A]/20 pt-1.5 space-y-0.5 font-body text-[11px] text-[#E3D28A]/80">
              <div className="flex justify-between gap-6">
                <span>Points</span>
                <span className="font-bold text-[#E3D28A]">
                  {hasResults ? tooltip.team.totalPoints : "—"}
                </span>
              </div>
              <div className="flex justify-between gap-6">
                <span>1st / 2nd / 3rd</span>
                <span className="text-[#E3D28A]/60">
                  {hasResults
                    ? `${tooltip.team.firstPlaceCount} / ${tooltip.team.secondPlaceCount} / ${tooltip.team.thirdPlaceCount}`
                    : "— / — / —"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SVG chart — fully responsive via viewBox */}
      <svg
        ref={svgRef}
        viewBox={`0 0 400 ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full"
        style={{ height: "auto", display: "block" }}
      >
        {/* Defs: clip path */}
        <defs>
          <clipPath id={`${uid}-clip`}>
            <rect x={PAD_LEFT} y={PAD_TOP} width={400 - PAD_LEFT - PAD_RIGHT} height={chartH} />
          </clipPath>
        </defs>

        {/* Y-axis grid lines + labels */}
        {yTicks.map((tick) => {
          const y = PAD_TOP + chartH - (hasResults ? (tick / maxPts) * chartH : 0);
          return (
            <g key={tick}>
              <line
                x1={PAD_LEFT}
                x2={400 - PAD_RIGHT}
                y1={y}
                y2={y}
                stroke={COLORS.goldDim}
                strokeWidth={0.5}
              />
              <text
                x={PAD_LEFT - 6}
                y={y + 4}
                textAnchor="end"
                fontSize={9}
                fontFamily="var(--font-body-sans)"
                fill={COLORS.gold}
                fillOpacity={0.4}
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* Baseline */}
        <line
          x1={PAD_LEFT}
          x2={400 - PAD_RIGHT}
          y1={PAD_TOP + chartH}
          y2={PAD_TOP + chartH}
          stroke={COLORS.gold}
          strokeOpacity={0.3}
          strokeWidth={0.5}
        />

        {/* Bars — one per team */}
        {teams.map((team, i) => {
          const n = teams.length;
          const slotW = (400 - PAD_LEFT - PAD_RIGHT) / n;
          const barW = Math.min(slotW * 0.52, 56);
          const cx = PAD_LEFT + slotW * i + slotW / 2;
          const bh = barHeight(team.totalPoints);
          const barX = cx - barW / 2;
          const barY = PAD_TOP + chartH - bh;
          const color = teamColor(team.teamId);
          const isActive = hovered === null || hovered === team.teamId;
          const opacity = isActive ? 1 : 0.22;

          // Zero-state: thin placeholder bar
          const placeholderH = hasResults ? 0 : 3;
          const finalBarH = hasResults ? Math.max(bh, 0) : placeholderH;
          const finalBarY = PAD_TOP + chartH - finalBarH;

          return (
            <g
              key={team.teamId}
              style={{
                cursor: "pointer",
                opacity,
                transition: reducedMotion ? "none" : "opacity 0.2s ease",
              }}
              onMouseEnter={() => handleEnter(team, (cx / 400) * 100)}
              onMouseLeave={handleLeave}
              onFocus={() => handleEnter(team, (cx / 400) * 100)}
              onBlur={handleLeave}
              onTouchStart={(e) => {
                e.preventDefault();
                handleEnter(team, (cx / 400) * 100);
              }}
              onTouchEnd={handleLeave}
              role="button"
              aria-label={`${team.teamName}: ${hasResults ? team.totalPoints + " points" : "no points yet"}`}
              tabIndex={0}
            >
              {/* Hit-area (invisible, extends below bar for easy tapping) */}
              <rect
                x={cx - slotW / 2}
                y={PAD_TOP}
                width={slotW}
                height={chartH + PAD_BOT - 8}
                fill="transparent"
              />

              {/* Bar fill */}
              <rect
                x={barX}
                y={finalBarY}
                width={barW}
                height={finalBarH}
                fill={color}
                fillOpacity={hovered === team.teamId ? 1 : 0.82}
                style={{
                  transition: reducedMotion
                    ? "none"
                    : "height 0.5s cubic-bezier(0.4,0,0.2,1), y 0.5s cubic-bezier(0.4,0,0.2,1)",
                }}
              />

              {/* Top accent line (highlight) */}
              {finalBarH > 0 && (
                <rect
                  x={barX}
                  y={finalBarY}
                  width={barW}
                  height={1.5}
                  fill={color}
                  fillOpacity={0.9}
                />
              )}

              {/* Team label */}
              <text
                x={cx}
                y={PAD_TOP + chartH + 16}
                textAnchor="middle"
                fontSize={10}
                fontWeight="700"
                fontFamily="var(--font-display-serif)"
                letterSpacing={1.5}
                fill={hovered === team.teamId ? color : COLORS.gold}
                fillOpacity={hovered === team.teamId ? 1 : 0.7}
                style={{
                  transition: reducedMotion ? "none" : "fill 0.2s, opacity 0.2s",
                }}
              >
                {team.teamName}
              </text>

              {/* Points label above bar */}
              {hasResults && bh > 12 && (
                <text
                  x={cx}
                  y={barY - 5}
                  textAnchor="middle"
                  fontSize={9}
                  fontFamily="var(--font-body-sans)"
                  fill={color}
                  fillOpacity={0.9}
                >
                  {team.totalPoints}
                </text>
              )}

              {/* Rank badge */}
              {hasResults && (
                <text
                  x={cx}
                  y={PAD_TOP + chartH + 30}
                  textAnchor="middle"
                  fontSize={9}
                  fontFamily="var(--font-display-serif)"
                  fill={COLORS.fire}
                  fillOpacity={0.8}
                >
                  #{team.rank}
                </text>
              )}
            </g>
          );
        })}

        {/* Zero-state label */}
        {!hasResults && (
          <text
            x={(400 + PAD_LEFT) / 2}
            y={PAD_TOP + chartH / 2}
            textAnchor="middle"
            fontSize={10}
            fontFamily="var(--font-body-sans)"
            fill={COLORS.gold}
            fillOpacity={0.3}
            letterSpacing={2}
          >
            NO COMPLETED EVENTS YET
          </text>
        )}
      </svg>
    </div>
  );
}

// ─── loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading leaderboard">
      {/* Chart skeleton */}
      <div className="border border-[#E3D28A]/20 bg-[#110B0B] p-6 animate-pulse h-[260px] flex items-end gap-6 justify-center">
        {[60, 80, 45, 70].map((h, i) => (
          <div
            key={i}
            className="bg-[#E3D28A]/10 w-14 rounded-sm"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      {/* Table rows skeleton */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="border border-[#E3D28A]/20 bg-[#110B0B] p-4 sm:p-5 flex items-center justify-between animate-pulse"
        >
          <div className="flex items-center gap-3">
            <div className="h-5 w-8 bg-[#E3D28A]/10" />
            <div className="h-5 w-24 bg-[#E3D28A]/10" />
          </div>
          <div className="h-5 w-12 bg-[#E3D28A]/10" />
        </div>
      ))}
    </div>
  );
}

// ─── error state ──────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="border border-[#E02E0B]/40 bg-[#5A0E0B]/10 p-8 text-center space-y-4 max-w-lg mx-auto">
      <div className="flex justify-center text-[#E02E0B]">
        <AlertCircle size={32} />
      </div>
      <p className="font-body text-xs sm:text-sm text-[#E3D28A]/80">{message}</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 bg-[#E02E0B] text-[#E3D28A] font-display text-xs uppercase tracking-wider font-bold hover:bg-[#941108] transition-colors"
      >
        <RefreshCw size={14} />
        <span>TRY AGAIN</span>
      </button>
    </div>
  );
}

// ─── standings table ──────────────────────────────────────────────────────────

function StandingsTable({ teams, hasResults }: { teams: TeamLeaderboardEntry[]; hasResults: boolean }) {
  return (
    <div className="border border-[#E3D28A]/40 bg-[#110B0B] overflow-x-auto">
      <table className="w-full text-left font-body text-xs sm:text-sm border-collapse" aria-label="Leaderboard standings">
        <thead>
          <tr className="border-b border-[#E3D28A]/30 font-display text-[11px] sm:text-xs tracking-wider text-[#E3D28A]/70 uppercase">
            <th className="py-3.5 px-5">Position</th>
            <th className="py-3.5 px-5">Team</th>
            <th className="py-3.5 px-5 text-right">Points</th>
            <th className="py-3.5 px-5 text-right">1st</th>
            <th className="py-3.5 px-5 text-right">2nd</th>
            <th className="py-3.5 px-5 text-right">3rd</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E3D28A]/15">
          {teams.map((team) => (
            <tr key={team.teamId} className="hover:bg-[#5A0E0B]/20 transition-colors">
              <td className="py-3 px-5 font-display font-bold text-[#E02E0B]">
                {hasResults ? formatRank(team.rank) : "—"}
              </td>
              <td className="py-3 px-5 font-display font-bold tracking-wider"
                style={{ color: teamColor(team.teamId) }}>
                {team.teamName}
              </td>
              <td className="py-3 px-5 text-right font-display font-bold text-[#E3D28A]">
                {hasResults ? team.totalPoints : "—"}
              </td>
              <td className="py-3 px-5 text-right text-[#E3D28A]/70">
                {hasResults ? team.firstPlaceCount : "—"}
              </td>
              <td className="py-3 px-5 text-right text-[#E3D28A]/70">
                {hasResults ? team.secondPlaceCount : "—"}
              </td>
              <td className="py-3 px-5 text-right text-[#E3D28A]/70">
                {hasResults ? team.thirdPlaceCount : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── category breakdown ───────────────────────────────────────────────────────

function CategoryBreakdown({ teams, hasResults }: { teams: TeamLeaderboardEntry[]; hasResults: boolean }) {
  return (
    <div className="border border-[#E3D28A]/40 bg-[#110B0B] overflow-x-auto">
      <table className="w-full text-left font-body text-xs sm:text-sm border-collapse" aria-label="Points breakdown by category">
        <thead>
          <tr className="border-b border-[#E3D28A]/30 font-display text-[11px] sm:text-xs tracking-wider text-[#E3D28A]/70 uppercase">
            <th className="py-3.5 px-5">Team</th>
            <th className="py-3.5 px-5 text-right">Group</th>
            <th className="py-3.5 px-5 text-right">Duo</th>
            <th className="py-3.5 px-5 text-right">Solo</th>
            <th className="py-3.5 px-5 text-right">Off-Stage</th>
            <th className="py-3.5 px-5 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E3D28A]/15">
          {teams.map((team) => (
            <tr key={team.teamId} className="hover:bg-[#5A0E0B]/20 transition-colors">
              <td className="py-3 px-5 font-display font-bold tracking-wider"
                style={{ color: teamColor(team.teamId) }}>
                {team.teamName}
              </td>
              <td className="py-3 px-5 text-right text-[#E3D28A]/70">{hasResults ? team.groupPoints : "—"}</td>
              <td className="py-3 px-5 text-right text-[#E3D28A]/70">{hasResults ? team.duoPoints : "—"}</td>
              <td className="py-3 px-5 text-right text-[#E3D28A]/70">{hasResults ? team.soloPoints : "—"}</td>
              <td className="py-3 px-5 text-right text-[#E3D28A]/70">{hasResults ? team.offStagePoints : "—"}</td>
              <td className="py-3 px-5 text-right font-display font-bold text-[#E3D28A]">{hasResults ? team.totalPoints : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/leaderboard");
      if (!res.ok) throw new Error(`Failed to load leaderboard (status ${res.status})`);
      const json: LeaderboardResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function fetchData() {
      try {
        const res = await fetch("/api/leaderboard");
        if (!res.ok) throw new Error(`Failed to load leaderboard (status ${res.status})`);
        const json: LeaderboardResponse = await res.json();
        if (!ignore) { setData(json); setError(null); }
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : "Failed to load leaderboard");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchData();
    return () => { ignore = true; };
  }, []);

  const handleRetry = () => { loadLeaderboard(); };

  const teams = data?.teams ?? [];
  const hasResults = teams.some((t) => t.totalPoints > 0);

  return (
    <div className="max-w-4xl mx-auto px-6 sm:px-8 pt-28 pb-16 space-y-12">

      {/* Title */}
      <div className="space-y-1.5">
        <h1 className="font-display font-black text-4xl sm:text-5xl text-[#E3D28A] tracking-wider uppercase">
          LEADERBOARD
        </h1>
        <p className="font-body text-xs sm:text-sm text-[#E3D28A]/70">
          Official championship standings for the four houses of Mudra 2026.
        </p>
      </div>

      {/* Loading */}
      {loading && <LoadingSkeleton />}

      {/* Error */}
      {!loading && error && <ErrorState message={error} onRetry={handleRetry} />}

      {/* Content */}
      {!loading && !error && data && (
        <>
          {/* ── Visual graph — centerpiece ── */}
          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-xs tracking-widest text-[#E3D28A]/60 uppercase">
                Points Comparison
              </h2>
              {hasResults && (
                <span className="font-body text-[10px] text-[#E3D28A]/30">
                  Hover or tap a team
                </span>
              )}
            </div>

            <div className="border border-[#E3D28A]/30 bg-[#110B0B] px-4 pt-4 pb-2">
              <TeamBarChart teams={teams} hasResults={hasResults} />
            </div>

            {!hasResults && (
              <p className="font-body text-[11px] text-[#E3D28A]/40 italic text-center pt-1">
                No completed events — standings will update as results are recorded.
              </p>
            )}
          </div>

          {/* ── Standings table ── */}
          <div className="space-y-2">
            <h2 className="font-display text-xs tracking-widest text-[#E3D28A]/60 uppercase">
              Standings
            </h2>
            <StandingsTable teams={teams} hasResults={hasResults} />
          </div>

          {/* ── Category breakdown ── */}
          <div className="space-y-2">
            <h2 className="font-display text-xs tracking-widest text-[#E3D28A]/60 uppercase">
              Points by Category
            </h2>
            <CategoryBreakdown teams={teams} hasResults={hasResults} />
          </div>

          {/* Footer meta */}
          <p className="text-center font-body text-[10px] text-[#E3D28A]/30">
            Last updated:{" "}
            {new Date(data.lastUpdated).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            {" · "}
            {data.completedEventCount} completed event
            {data.completedEventCount !== 1 ? "s" : ""}
          </p>
        </>
      )}
    </div>
  );
}
