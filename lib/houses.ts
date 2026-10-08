import type { TeamId } from "@/types/team";

export interface HouseConfig {
  id: TeamId;
  /** Display name, as used everywhere else in the app. */
  name: string;
  /**
   * Official house code. Placeholder (`null`) until the real codes are
   * supplied — do not fill these in by guessing.
   */
  code: string | null;
  /** ID-card artwork: English wordmark on the front. */
  frontImage: string;
  /** ID-card artwork: Malayalam wordmark on the back. */
  backImage: string;
}

/**
 * Single source of truth for house → ID-card artwork. Each image is mapped
 * explicitly by house; nothing is inferred from file order.
 */
export const HOUSE_CONFIG: Record<TeamId, HouseConfig> = {
  agni: {
    id: "agni",
    name: "AGNI",
    code: null,
    frontImage: "/images/lanyard/agni-front.png",
    backImage: "/images/lanyard/agni-back.png",
  },
  raaga: {
    id: "raaga",
    name: "RAAGA",
    code: null,
    frontImage: "/images/lanyard/raaga-front.png",
    backImage: "/images/lanyard/raaga-back.png",
  },
  tarang: {
    id: "tarang",
    name: "TARANG",
    code: null,
    frontImage: "/images/lanyard/tarang-front.png",
    backImage: "/images/lanyard/tarang-back.png",
  },
  utsav: {
    id: "utsav",
    name: "UTSAV",
    code: null,
    frontImage: "/images/lanyard/utsav-front.png",
    backImage: "/images/lanyard/utsav-back.png",
  },
};

/**
 * Resolve the Team Lookup API's team value to a house. Returns null for a
 * missing or unknown value — callers must show a neutral state, never guess.
 */
export function resolveHouse(team: string | null | undefined): HouseConfig | null {
  if (!team) return null;
  const key = team.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(HOUSE_CONFIG, key)
    ? HOUSE_CONFIG[key as TeamId]
    : null;
}
