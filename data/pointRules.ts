import { PointsCategory } from "@/types/event";

export interface PlacementPoints {
  first: number;
  second: number;
  third: number;
}

export const POINT_RULES: Record<PointsCategory, PlacementPoints> = {
  group: {
    first: 20,
    second: 15,
    third: 10,
  },
  duo: {
    first: 12,
    second: 8,
    third: 5,
  },
  solo: {
    first: 10,
    second: 7,
    third: 5,
  },
  offstage: {
    first: 8,
    second: 5,
    third: 3,
  },
} as const;

export function getPointsForRank(pointsCategory: PointsCategory, rank: 1 | 2 | 3): number {
  const rules = POINT_RULES[pointsCategory];
  if (!rules) return 0;
  if (rank === 1) return rules.first;
  if (rank === 2) return rules.second;
  if (rank === 3) return rules.third;
  return 0;
}
