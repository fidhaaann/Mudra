import { TeamId } from './team';

export type PointsCategory = 'group' | 'duo' | 'solo' | 'offstage';
export type LeaderboardTeamId = 'raaga' | 'agni' | 'tarang' | 'utsav';

export interface CalculatedLeaderboardRow {
  team: LeaderboardTeamId;
  totalPoints: number;
  firstPlaceCount: number;
  secondPlaceCount: number;
  thirdPlaceCount: number;
}

export interface ManualLeaderboardRow {
  team: LeaderboardTeamId;
  totalPoints: number;
  note: string;
  lastUpdated: string;
}

export interface EffectiveLeaderboardRow extends CalculatedLeaderboardRow {
  calculatedPoints: number;
  manualTotal: number | null;
  totalPoints: number;
  rank: number;
  pointGap: number;
}

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
