export const TEAM_COLORS = {
  tarang: "#93C5FD",
  agni: "#FCA5A5",
  utsav: "#FDE68A",
  raaga: "#86EFAC",
} as const;

export const TEAM_PASTEL_COLORS = TEAM_COLORS;

export function getTeamColor(teamId: string): string {
  return TEAM_COLORS[teamId.trim().toLowerCase() as keyof typeof TEAM_COLORS] ?? "#E3D28A";
}

export function getTeamPastelColor(teamId: string): string {
  return getTeamColor(teamId);
}
