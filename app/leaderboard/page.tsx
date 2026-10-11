import type { Metadata } from "next";
import LeaderboardClient from "./LeaderboardClient";

export const metadata: Metadata = {
  title: "Competition Leaderboard",
  description:
    "Check the latest team standings and competition scores for MUDRA 2026, the cultural arts festival of Toc H Institute of Science & Technology.",
};

export default function LeaderboardPage() {
  return <LeaderboardClient />;
}
