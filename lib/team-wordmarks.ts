import type { TeamId } from "@/types/team";

export interface Wordmark {
  src: string;
  /** Intrinsic width / height of the cropped artwork. */
  aspect: number;
  /**
   * Vertical band of the main letter body as fractions of the artwork height
   * (excluding marks such as ് or the tail of ഉ). Bodies are drawn at the same
   * height in every language so Malayalam matches the English cap height.
   */
  body?: [top: number, bottom: number];
}

export interface TeamWordmarks {
  englishName: string;
  malayalamName: string;
  english: Wordmark;
  malayalam: Wordmark;
}

/**
 * Lettered team-name artwork (English + Malayalam).
 * The WebPs are tight, transparent crops of the black-background JPG masters
 * in the same folders, so they sit on any MUDRA surface without a black box.
 */
export const TEAM_WORDMARKS: Record<TeamId, TeamWordmarks> = {
  raaga: {
    englishName: "RAAGA",
    malayalamName: "രാഗ",
    english: { src: "/images/raaga/raagaE.webp", aspect: 486 / 160 },
    malayalam: { src: "/images/raaga/raagaM.webp", aspect: 337 / 160 },
  },
  agni: {
    englishName: "AGNI",
    malayalamName: "അഗ്നി",
    english: { src: "/images/agni/agniE.webp", aspect: 333 / 160 },
    malayalam: { src: "/images/agni/agniM.webp", aspect: 313 / 160, body: [53 / 160, 1] },
  },
  tarang: {
    englishName: "TARANG",
    malayalamName: "തരംഗ്",
    english: { src: "/images/tarang/tarangE.webp", aspect: 552 / 160 },
    malayalam: { src: "/images/tarang/tarangM.webp", aspect: 364 / 160, body: [50 / 160, 1] },
  },
  utsav: {
    englishName: "UTSAV",
    malayalamName: "ഉത്സവ്",
    english: { src: "/images/utsav/utsavE.webp", aspect: 444 / 160 },
    malayalam: { src: "/images/utsav/utsavM.webp", aspect: 300 / 160, body: [43 / 160, 128 / 160] },
  },
};

export function getTeamWordmarks(teamId: string): TeamWordmarks | undefined {
  return TEAM_WORDMARKS[teamId.trim().toLowerCase() as TeamId];
}
