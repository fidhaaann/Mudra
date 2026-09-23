import { Event, PointsCategory } from "@/types/event";
import { Team, TeamStanding, TeamId } from "@/types/team";
import { EventResult } from "@/types/result";
import { getPointsForRank } from "@/data/pointRules";
import { TEAMS } from "@/data/teams";
import { RECORDED_RESULTS } from "@/data/mockResults";

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
 * Calculates standings for all teams based on verified event results.
 */
export function calculateTeamStandings(
  teams: Team[] = TEAMS,
  results: Record<string, EventResult> = RECORDED_RESULTS
): TeamStanding[] {
  const standingsMap: Record<TeamId, { totalPoints: number; firstCount: number; secondCount: number; thirdCount: number }> = {
    raaga: { totalPoints: 0, firstCount: 0, secondCount: 0, thirdCount: 0 },
    agni: { totalPoints: 0, firstCount: 0, secondCount: 0, thirdCount: 0 },
    tarang: { totalPoints: 0, firstCount: 0, secondCount: 0, thirdCount: 0 },
    utsav: { totalPoints: 0, firstCount: 0, secondCount: 0, thirdCount: 0 },
  };

  // Aggregate points and placements from verified results
  Object.values(results).forEach((result) => {
    result.placements.forEach((placement) => {
      const teamStats = standingsMap[placement.teamId];
      if (teamStats) {
        teamStats.totalPoints += placement.pointsAwarded;
        if (placement.placement === 1) teamStats.firstCount += 1;
        if (placement.placement === 2) teamStats.secondCount += 1;
        if (placement.placement === 3) teamStats.thirdCount += 1;
      }
    });
  });

  const standings: TeamStanding[] = teams.map((team) => {
    const stats = standingsMap[team.id] || { totalPoints: 0, firstCount: 0, secondCount: 0, thirdCount: 0 };
    return {
      team: {
        ...team,
        totalPoints: stats.totalPoints,
      },
      totalPoints: stats.totalPoints,
      firstCount: stats.firstCount,
      secondCount: stats.secondCount,
      thirdCount: stats.thirdCount,
      position: 1,
    };
  });

  const hasAnyPoints = standings.some((s) => s.totalPoints > 0);

  if (hasAnyPoints) {
    standings.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      return b.firstCount - a.firstCount;
    });

    standings.forEach((item, index) => {
      item.position = index + 1;
    });
  } else {
    standings.forEach((item, index) => {
      item.position = index + 1;
    });
  }

  return standings;
}
