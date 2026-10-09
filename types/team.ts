/**
 * Canonical competition team ids, in the official display / sheet order.
 * This is the single source of truth for which teams exist — derive every
 * team list, map and validator from it (see data/teams.ts) instead of
 * hardcoding team names.
 */
export const TEAM_IDS = ["raaga", "agni", "tarang", "utsav", "mba"] as const;

export type TeamId = (typeof TEAM_IDS)[number];

export interface Team {
  id: TeamId;
  name: string;
  totalPoints: number;
}

export interface TeamStanding {
  team: Team;
  position: number;
  totalPoints: number;
  firstCount: number;
  secondCount: number;
  thirdCount: number;
}
