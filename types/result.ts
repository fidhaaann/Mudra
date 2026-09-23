import { TeamId } from "./team";

export interface PodiumPlacement {
  placement: 1 | 2 | 3;
  participantOrTeamName: string;
  teamId: TeamId;
  pointsAwarded: number;
}

export interface EventResult {
  eventId: string;
  placements: PodiumPlacement[];
  publishedAt?: string;
  isDemoData: boolean;
}
