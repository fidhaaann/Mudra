import type { Metadata } from "next";
import ScheduleClient from "./ScheduleClient";

export const metadata: Metadata = {
  title: "Event Schedule",
  description:
    "View the MUDRA 2026 event schedule for the cultural arts festival of Toc H Institute of Science & Technology, Ernakulam, Kerala.",
};

export default function SchedulePage() {
  return <ScheduleClient />;
}
