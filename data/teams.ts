import { TEAM_IDS, Team, TeamId } from "@/types/team";

/** Official display names, keyed by canonical team id. */
export const TEAM_NAMES: Record<TeamId, string> = {
  raaga: "RAAGA",
  agni: "AGNI",
  tarang: "TARANG",
  utsav: "UTSAV",
  mba: "MBA",
};

/** All competition teams, in canonical order (see TEAM_IDS). */
export const TEAMS: Team[] = TEAM_IDS.map((id) => ({
  id,
  name: TEAM_NAMES[id],
  totalPoints: 0,
}));

/**
 * Alternative spellings that already exist in the competition spreadsheet.
 * The CALCULATED tab labels UTSAV as "UTSUV" (see CALCULATED_SHEET_LABELS),
 * so reading that tab back must map the label to the same team.
 */
const TEAM_ALIASES: Record<string, TeamId> = {
  utsuv: "utsav",
};

/**
 * Parse a team value from a sheet cell or request. Case- and
 * whitespace-insensitive. Returns null for blank or unrecognised values —
 * callers must skip those rows rather than guess a team.
 */
export function parseTeamId(value: unknown): TeamId | null {
  const key = String(value ?? "").trim().toLowerCase();
  if (!key) return null;
  if ((TEAM_IDS as readonly string[]).includes(key)) return key as TeamId;
  return TEAM_ALIASES[key] ?? null;
}

/**
 * TEAM column labels the backend writes to the CALCULATED tab. These match
 * the labels already in the live sheet (including "UTSUV"), so repeated
 * synchronisation finds identical rows and does not rewrite them.
 */
export const CALCULATED_SHEET_LABELS: Record<TeamId, string> = {
  raaga: "RAAGA",
  agni: "AGNI",
  tarang: "TARANG",
  utsav: "UTSUV",
  mba: "MBA",
};
