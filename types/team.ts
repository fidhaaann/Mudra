export type TeamId = "raaga" | "agni" | "tarang" | "utsav";

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
