import { Event, PointsCategory } from "@/types/event";
import { TEAM_IDS, Team, TeamStanding, TeamId } from "@/types/team";
import { EventResult } from "@/types/result";
import { getPointsForRank, POINT_RULES } from "@/data/pointRules";
import { TEAMS } from "@/data/teams";
import { RECORDED_RESULTS } from "@/data/recorded-results";

/**
 * Calculates points awarded for a given placement.
 * CRITICAL RULE: Scoring is strictly determined by pointsCategory,
 * NOT by participantType alone.
 * e.g., Painting Relay (participantType: 'group', pointsCategory: 'offstage') -> 8 / 5 / 3
 */
export function getEventPlacementPoints(event: Pick<Event, "pointsCategory">, rank: 1 | 2 | 3): number {
  return getPointsForRank(event.pointsCategory, rank);
}

export function getPointsForCategory(pointsCategory: PointsCategory, rank: 1 | 2 | 3): number {
  return getPointsForRank(pointsCategory, rank);
}

/**
 * Returns the official points for a placement strictly from the scoring table.
 * pointsCategory drives the score — the stored `pointsAwarded` value on any
 * result row is NEVER used, preventing sheet data from overriding official rules.
 */
export function officialPoints(pointsCategory: PointsCategory, rank: 1 | 2 | 3): number {
  return POINT_RULES[pointsCategory]?.[rank === 1 ? 'first' : rank === 2 ? 'second' : 'third'] ?? 0;
}

/**
 * Calculates standings for all teams based on verified event results.
 *
 * SCORING RULE: Points are always recalculated from the event's pointsCategory
 * using the official scoring table.  The `pointsAwarded` field on each
 * PodiumPlacement is ignored — it must never override the official table.
 *
 * RANKING RULE: Standard competition ranking — teams with equal totalPoints
 * share the same rank.  There is NO secondary tie-breaker (no firstCount,
 * no secondCount).  Equal totals produce equal ranks.
 */
export function calculateTeamStandings(
  teams: Team[] = TEAMS,
  results: Record<string, EventResult> = RECORDED_RESULTS,
  events: Record<string, Pick<Event, "id" | "pointsCategory">> = {}
): TeamStanding[] {
  type Stats = { totalPoints: number; firstCount: number; secondCount: number; thirdCount: number };
  // One zeroed entry per canonical team, so every team (including any with no
  // results yet) is always present.
  const standingsMap = Object.fromEntries(
    TEAM_IDS.map((id) => [id, { totalPoints: 0, firstCount: 0, secondCount: 0, thirdCount: 0 }])
  ) as Record<TeamId, Stats>;

  Object.values(results).forEach((result) => {
    // Look up the event's official pointsCategory; fall back gracefully if missing
    const eventMeta = events[result.eventId];

    result.placements.forEach((placement) => {
      const pos = placement.placement;
      if (pos !== 1 && pos !== 2 && pos !== 3) return; // skip invalid positions

      const teamStats = standingsMap[placement.teamId];
      if (!teamStats) return; // skip unrecognised teams

      // ALWAYS recalculate from official scoring table — never trust pointsAwarded
      const pts = eventMeta
        ? officialPoints(eventMeta.pointsCategory, pos)
        : placement.pointsAwarded; // legacy fallback when no event meta supplied

      teamStats.totalPoints += pts;
      if (pos === 1) teamStats.firstCount++;
      else if (pos === 2) teamStats.secondCount++;
      else if (pos === 3) teamStats.thirdCount++;
    });
  });

  const standings: TeamStanding[] = teams.map((team) => {
    const stats = standingsMap[team.id] ?? { totalPoints: 0, firstCount: 0, secondCount: 0, thirdCount: 0 };
    return {
      team: { ...team, totalPoints: stats.totalPoints },
      totalPoints:  stats.totalPoints,
      firstCount:   stats.firstCount,
      secondCount:  stats.secondCount,
      thirdCount:   stats.thirdCount,
      position: 1, // assigned below
    };
  });

  const hasAnyPoints = standings.some((s) => s.totalPoints > 0);

  if (hasAnyPoints) {
    // Sort by totalPoints descending ONLY — no secondary tie-breaker
    standings.sort((a, b) => b.totalPoints - a.totalPoints);
  }

  // Standard competition ranking: equal points → same rank.
  // Next distinct rank = number of teams ranked strictly above + 1.
  for (let i = 0; i < standings.length; i++) {
    if (i === 0 || standings[i].totalPoints !== standings[i - 1].totalPoints) {
      standings[i].position = i + 1;
    } else {
      standings[i].position = standings[i - 1].position;
    }
  }

  return standings;
}
