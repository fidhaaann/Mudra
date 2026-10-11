import type { Metadata } from "next";
import TeamClient from "./TeamClient";

export const metadata: Metadata = {
  title: "Teams & Participants",
  description:
    "Explore the participating teams and team information for MUDRA 2026 at Toc H Institute of Science & Technology, Ernakulam, Kerala.",
};

export default function TeamPage() {
  return <TeamClient />;
}
