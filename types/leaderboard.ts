import { TeamId } from './team';

export type PointsCategory = 'group' | 'duo' | 'solo' | 'offstage';

export interface TeamLeaderboardEntry {
  teamId: TeamId;
  teamName: string;
  rank: number;
  totalPoints: number;
  pointGap: number; // points behind the leading team (0 for 1st place)

  // Placement counts
  firstPlaceCount: number;
  secondPlaceCount: number;
  thirdPlaceCount: number;

  // Points by category
  groupPoints: number;
  duoPoints: number;
  soloPoints: number;
  offStagePoints: number;
}

export interface LeaderboardResponse {
  teams: TeamLeaderboardEntry[];
  completedEventCount: number;
  lastUpdated: string; // ISO timestamp
}
