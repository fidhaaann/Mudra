import { fetchEvents, fetchResults } from './competition';
import { TeamId } from '@/types/team';
import { PointsCategory, TeamLeaderboardEntry, LeaderboardResponse } from '@/types/leaderboard';

// Official scoring table — source of truth, never override with sheet values
const SCORING_TABLE: Record<PointsCategory, Record<1 | 2 | 3, number>> = {
  group:    { 1: 20, 2: 15, 3: 10 },
  duo:      { 1: 12, 2:  8, 3:  5 },
  solo:     { 1: 10, 2:  7, 3:  5 },
  offstage: { 1:  8, 2:  5, 3:  3 },
};

const ALL_TEAMS: { id: TeamId; name: string }[] = [
  { id: 'raaga',  name: 'RAAGA'  },
  { id: 'agni',   name: 'AGNI'   },
  { id: 'tarang', name: 'TARANG' },
  { id: 'utsav',  name: 'UTSAV'  },
];

export async function buildLeaderboard(): Promise<LeaderboardResponse> {
  // Fetch both in parallel
  const [events, results] = await Promise.all([fetchEvents(), fetchResults()]);

  // Build a map of event metadata keyed by id (lowercased for safe lookup)
  const eventMap = new Map(events.map(e => [e.id.toLowerCase(), e]));

  // Accumulator per team
  interface TeamAccumulator {
    totalPoints:      number;
    firstPlaceCount:  number;
    secondPlaceCount: number;
    thirdPlaceCount:  number;
    groupPoints:      number;
    duoPoints:        number;
    soloPoints:       number;
    offStagePoints:   number;
  }

  const acc: Record<TeamId, TeamAccumulator> = {
    raaga:  zero(),
    agni:   zero(),
    tarang: zero(),
    utsav:  zero(),
  };

  let completedEventCount = 0;
  const countedEventIds = new Set<string>();

  for (const result of results) {
    // results are already filtered to COMPLETED events by fetchResults()
    const event = eventMap.get(result.eventId.toLowerCase());
    if (!event) continue; // unknown event — skip

    const pointsCat = event.pointsCategory as PointsCategory;
    if (!countedEventIds.has(result.eventId.toLowerCase())) {
      countedEventIds.add(result.eventId.toLowerCase());
      completedEventCount++;
    }

    for (const placement of result.placements) {
      const pos = placement.placement;
      if (pos !== 1 && pos !== 2 && pos !== 3) continue;

      const team = acc[placement.teamId];
      if (!team) continue; // unrecognised team — skip

      // Always use official scoring, ignore any points value from the sheet
      const officialPoints = SCORING_TABLE[pointsCat]?.[pos];
      if (officialPoints === undefined) {
        console.warn(
          `[leaderboard] No scoring rule for category="${pointsCat}" position=${pos}. Skipping.`
        );
        continue;
      }

      team.totalPoints += officialPoints;

      if (pos === 1) team.firstPlaceCount++;
      else if (pos === 2) team.secondPlaceCount++;
      else if (pos === 3) team.thirdPlaceCount++;

      if (pointsCat === 'group')    team.groupPoints    += officialPoints;
      else if (pointsCat === 'duo') team.duoPoints      += officialPoints;
      else if (pointsCat === 'solo') team.soloPoints    += officialPoints;
      else if (pointsCat === 'offstage') team.offStagePoints += officialPoints;
    }
  }

  // Find the highest total to compute gap
  const maxPoints = Math.max(...ALL_TEAMS.map(t => acc[t.id].totalPoints));

  // Build entries for all four teams
  const entries: TeamLeaderboardEntry[] = ALL_TEAMS.map(team => {
    const a = acc[team.id];
    return {
      teamId:           team.id,
      teamName:         team.name,
      rank:             0, // assigned below
      totalPoints:      a.totalPoints,
      pointGap:         maxPoints - a.totalPoints,
      firstPlaceCount:  a.firstPlaceCount,
      secondPlaceCount: a.secondPlaceCount,
      thirdPlaceCount:  a.thirdPlaceCount,
      groupPoints:      a.groupPoints,
      duoPoints:        a.duoPoints,
      soloPoints:       a.soloPoints,
      offStagePoints:   a.offStagePoints,
    };
  });

  // Sort by total points descending only — placement counts are statistics, not tie-breakers
  entries.sort((a, b) => b.totalPoints - a.totalPoints);

  // Standard competition ranking (1224, not 1223):
  // Teams with equal points share the same rank; the next distinct rank
  // equals the total number of teams ranked above it plus one.
  for (let i = 0; i < entries.length; i++) {
    if (i === 0 || entries[i].totalPoints !== entries[i - 1].totalPoints) {
      // rank = 1-based index of this entry (first in its points group)
      entries[i].rank = i + 1;
    } else {
      // same points as the previous entry → share its rank
      entries[i].rank = entries[i - 1].rank;
    }
  }

  return {
    teams: entries,
    completedEventCount,
    lastUpdated: new Date().toISOString(),
  };
}

function zero() {
  return {
    totalPoints:      0,
    firstPlaceCount:  0,
    secondPlaceCount: 0,
    thirdPlaceCount:  0,
    groupPoints:      0,
    duoPoints:        0,
    soloPoints:       0,
    offStagePoints:   0,
  };
}
