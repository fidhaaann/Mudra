import { TeamId } from './team';

export type PointsCategory = 'group' | 'duo' | 'solo' | 'offstage';

/** Whether a response reflects current sheet data or a fallback copy. */
export type DataStatus = 'live' | 'stale';
/** Leaderboard rows use the canonical team ids (see TEAM_IDS). */
export type LeaderboardTeamId = TeamId;

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
  /** When the underlying sheet data was read (ISO) — not the response time. */
  lastUpdated: string;
  /**
   * 'live' when every source was read from Google Sheets within its cache
   * window; 'stale' when a fallback copy is being shown because Sheets is
   * unavailable or slow. Clients should say so instead of implying live data.
   */
  dataStatus: DataStatus;
}
