"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  useId,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { AlertCircle, RefreshCw } from "lucide-react";
import { TeamLeaderboardEntry, LeaderboardResponse } from "@/types/leaderboard";
import { getTeamColor } from "@/lib/team-colors";

// ─── constants ───────────────────────────────────────────────────────────────

const COLORS = {
  bg: "#110B0B",
  gold: "#E3D28A",
  fire: "#E02E0B",
  darkRed: "#5A0E0B",
  goldDim: "rgba(227,210,138,0.18)",
  goldFaint: "rgba(227,210,138,0.06)",
} as const;

function teamColor(teamId: string): string {
  return getTeamColor(teamId);
}

// ─── helpers ─────────────────────────────────────────────────────────────────

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

/**
 * Tooltip state uses viewport-relative pixel coords (clientX/Y) so the tooltip
 * can be rendered as `position: fixed` and never escapes the viewport.
 */
interface TooltipState {
  clientX: number;
  clientY: number;
  team: TeamLeaderboardEntry;
}

/** Tooltip width in px — must match the rendered box so clamping is accurate. */
const TOOLTIP_W = 172;
/** Tooltip height estimate — used to decide whether to show above or below. */
const TOOLTIP_H = 100;

// Detects client-side hydration without triggering the set-state-in-effect lint rule.
// useSyncExternalStore returns the server snapshot ("false") on SSR, and the client
// snapshot ("true") after hydration — with no extra render caused by setState.
function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},   // subscribe (no-op — value never changes after mount)
    () => true,       // client snapshot: mounted
    () => false       // server snapshot: not mounted
  );
}

function TeamBarChart({ teams, hasResults }: ChartProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isClient = useIsClient();
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

  // Chart geometry (SVG units)
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

  /**
   * Compute a viewport-safe fixed position for the tooltip.
   * Prefers placing the tooltip above the cursor; falls back to below.
   * Clamps horizontally so it never escapes the viewport.
   */
  function safeTooltipStyle(clientX: number, clientY: number): React.CSSProperties {
    const vw = typeof window !== "undefined" ? window.innerWidth : 400;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;

    // Center horizontally on the cursor, then clamp to viewport edges
    const rawLeft = clientX - TOOLTIP_W / 2;
    const left = Math.max(8, Math.min(rawLeft, vw - TOOLTIP_W - 8));

    // Show above cursor if there's room, else below
    const top =
      clientY - TOOLTIP_H - 12 > 0
        ? clientY - TOOLTIP_H - 12
        : Math.min(clientY + 16, vh - TOOLTIP_H - 8);

    return { position: "fixed", left, top, zIndex: 50 };
  }

  // Touch support: synthesise a clientX/Y from touch coordinates
  function handleTouchStart(team: TeamLeaderboardEntry, e: React.TouchEvent<SVGGElement>) {
    e.preventDefault();
    const touch = e.touches[0];
    if (touch) {
      setHovered(team.teamId);
      setTooltip({ clientX: touch.clientX, clientY: touch.clientY, team });
    }
  }

  function handleMouseEnter(team: TeamLeaderboardEntry, e: React.MouseEvent<SVGGElement>) {
    setHovered(team.teamId);
    setTooltip({ clientX: e.clientX, clientY: e.clientY, team });
  }

  function handleMouseMove(team: TeamLeaderboardEntry, e: React.MouseEvent<SVGGElement>) {
    if (hovered === team.teamId) {
      setTooltip({ clientX: e.clientX, clientY: e.clientY, team });
    }
  }

  function handleLeave() {
    setHovered(null);
    setTooltip(null);
  }

  // Dismiss on scroll so tooltip never lingers out-of-sync
  useEffect(() => {
    if (!tooltip) return;
    const dismiss = () => setTooltip(null);
    window.addEventListener("scroll", dismiss, { passive: true });
    return () => window.removeEventListener("scroll", dismiss);
  }, [tooltip]);

  return (
    // overflow-hidden ensures no child can push the container wider
    <div
      ref={containerRef}
      className="relative w-full select-none overflow-hidden"
      aria-label="Team points bar chart"
      role="img"
    >
      {/* Tooltip — rendered via portal to document.body so it escapes any
          overflow:hidden / stacking-context ancestor in the chart wrapper */}
      {isClient && tooltip && createPortal(
        <div
          className="pointer-events-none"
          style={safeTooltipStyle(tooltip.clientX, tooltip.clientY)}
        >
          <div
            className="border border-[#E3D28A]/60 bg-[#110B0B] px-4 py-3 space-y-1"
            style={{ width: TOOLTIP_W }}
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
              <div className="flex justify-between gap-4">
                <span>Points</span>
                <span className="font-bold text-[#E3D28A]">
                  {hasResults ? tooltip.team.totalPoints : "—"}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="shrink-0">1st / 2nd / 3rd</span>
                <span className="text-[#E3D28A]/60 text-right">
                  {hasResults
                    ? `${tooltip.team.firstPlaceCount} / ${tooltip.team.secondPlaceCount} / ${tooltip.team.thirdPlaceCount}`
                    : "— / — / —"}
                </span>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* SVG chart — fully responsive via viewBox + w-full */}
      <svg
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
              onMouseEnter={(e) => handleMouseEnter(team, e)}
              onMouseMove={(e) => handleMouseMove(team, e)}
              onMouseLeave={handleLeave}
              onFocus={(e) => {
                // For keyboard focus, anchor tooltip near the SVG element
                const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
                setHovered(team.teamId);
                setTooltip({ clientX: rect.left + rect.width / 2, clientY: rect.top, team });
              }}
              onBlur={handleLeave}
              onTouchStart={(e) => handleTouchStart(team, e)}
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
      <div className="border border-[#E3D28A]/20 bg-[#110B0B] p-6 animate-pulse h-[260px] flex items-end gap-4 justify-center overflow-hidden">
        {[60, 80, 45, 70].map((h, i) => (
          <div
            key={i}
            className="bg-[#E3D28A]/10 w-12 sm:w-14 rounded-sm flex-shrink-0"
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
    // overflow-x-auto provides internal scroll for the table only — the wrapper
    // itself is constrained by the page's max-w container, so the page never scrolls.
    // min-w-0 w-full prevent the flex/grid child from over-stretching on narrow viewports.
    <div className="border border-[#E3D28A]/40 bg-[#110B0B] overflow-x-auto min-w-0 w-full">
      <table
        className="min-w-full text-left font-body text-xs sm:text-sm border-collapse"
        aria-label="Leaderboard standings"
      >
        <thead>
          <tr className="border-b border-[#E3D28A]/30 font-display text-[11px] sm:text-xs tracking-wider text-[#E3D28A]/70 uppercase">
            <th className="py-3.5 px-3 sm:px-5 whitespace-nowrap">Position</th>
            <th className="py-3.5 px-3 sm:px-5 whitespace-nowrap">Team</th>
            <th className="py-3.5 px-3 sm:px-5 text-right whitespace-nowrap">Points</th>
            <th className="py-3.5 px-3 sm:px-5 text-right whitespace-nowrap">1st</th>
            <th className="py-3.5 px-3 sm:px-5 text-right whitespace-nowrap">2nd</th>
            <th className="py-3.5 px-3 sm:px-5 text-right whitespace-nowrap">3rd</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E3D28A]/15">
          {teams.map((team) => (
            <tr key={team.teamId} className="hover:bg-[#5A0E0B]/20 transition-colors">
              <td className="py-3 px-3 sm:px-5 font-display font-bold text-[#E02E0B] whitespace-nowrap">
                {hasResults ? team.rank : "—"}
              </td>
              <td
                className="py-3 px-3 sm:px-5 font-display font-bold tracking-wider whitespace-nowrap"
                style={{ color: teamColor(team.teamId) }}
              >
                {team.teamName}
              </td>
              <td className="py-3 px-3 sm:px-5 text-right font-display font-bold text-[#E3D28A] whitespace-nowrap">
                {hasResults ? team.totalPoints : "—"}
              </td>
              <td className="py-3 px-3 sm:px-5 text-right text-[#E3D28A]/70 whitespace-nowrap">
                {hasResults ? team.firstPlaceCount : "—"}
              </td>
              <td className="py-3 px-3 sm:px-5 text-right text-[#E3D28A]/70 whitespace-nowrap">
                {hasResults ? team.secondPlaceCount : "—"}
              </td>
              <td className="py-3 px-3 sm:px-5 text-right text-[#E3D28A]/70 whitespace-nowrap">
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
    <div className="border border-[#E3D28A]/40 bg-[#110B0B] overflow-x-auto min-w-0 w-full">
      <table
        className="min-w-full text-left font-body text-xs sm:text-sm border-collapse"
        aria-label="Points breakdown by category"
      >
        <thead>
          <tr className="border-b border-[#E3D28A]/30 font-display text-[11px] sm:text-xs tracking-wider text-[#E3D28A]/70 uppercase">
            <th className="py-3.5 px-3 sm:px-5 whitespace-nowrap">Team</th>
            <th className="py-3.5 px-3 sm:px-5 text-right whitespace-nowrap">Group</th>
            <th className="py-3.5 px-3 sm:px-5 text-right whitespace-nowrap">Duo</th>
            <th className="py-3.5 px-3 sm:px-5 text-right whitespace-nowrap">Solo</th>
            <th className="py-3.5 px-3 sm:px-5 text-right whitespace-nowrap">Off-Stage</th>
            <th className="py-3.5 px-3 sm:px-5 text-right whitespace-nowrap">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E3D28A]/15">
          {teams.map((team) => (
            <tr key={team.teamId} className="hover:bg-[#5A0E0B]/20 transition-colors">
              <td
                className="py-3 px-3 sm:px-5 font-display font-bold tracking-wider whitespace-nowrap"
                style={{ color: teamColor(team.teamId) }}
              >
                {team.teamName}
              </td>
              <td className="py-3 px-3 sm:px-5 text-right text-[#E3D28A]/70 whitespace-nowrap">
                {hasResults ? team.groupPoints : "—"}
              </td>
              <td className="py-3 px-3 sm:px-5 text-right text-[#E3D28A]/70 whitespace-nowrap">
                {hasResults ? team.duoPoints : "—"}
              </td>
              <td className="py-3 px-3 sm:px-5 text-right text-[#E3D28A]/70 whitespace-nowrap">
                {hasResults ? team.soloPoints : "—"}
              </td>
              <td className="py-3 px-3 sm:px-5 text-right text-[#E3D28A]/70 whitespace-nowrap">
                {hasResults ? team.offStagePoints : "—"}
              </td>
              <td className="py-3 px-3 sm:px-5 text-right font-display font-bold text-[#E3D28A] whitespace-nowrap">
                {hasResults ? team.totalPoints : "—"}
              </td>
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
  const hasResults = (data?.completedEventCount ?? 0) > 0;

  return (
    // min-w-0 prevents the flex child from over-stretching on narrow viewports
    <div className="w-full min-w-0 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 space-y-12">

      {/* Title */}
      <div className="space-y-1.5 min-w-0">
        <h1 className="font-display font-black text-3xl sm:text-4xl lg:text-5xl text-[#E3D28A] tracking-wide sm:tracking-wider uppercase leading-tight">
          LEADERBOARD
        </h1>
        <p className="font-body text-xs sm:text-sm text-[#E3D28A]/70">
          Official championship standings for the four houses of Mudra.
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
          <div className="space-y-1 min-w-0">
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

            {/* overflow-hidden here ensures the SVG and its container never push the page wide */}
            <div className="border border-[#E3D28A]/30 bg-[#110B0B] px-4 pt-4 pb-2 overflow-hidden">
              <TeamBarChart teams={teams} hasResults={hasResults} />
            </div>

            {!hasResults && (
              <p className="font-body text-[11px] text-[#E3D28A]/40 italic text-center pt-1">
                No completed events — standings will update as results are recorded.
              </p>
            )}
          </div>

          {/* ── Standings table ── */}
          <div className="space-y-2 min-w-0">
            <h2 className="font-display text-xs tracking-widest text-[#E3D28A]/60 uppercase">
              Standings
            </h2>
            <StandingsTable teams={teams} hasResults={hasResults} />
          </div>

          {/* ── Category breakdown ── */}
          <div className="space-y-2 min-w-0">
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
