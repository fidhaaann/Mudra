import type { Metadata } from "next";
import EventsClient from "./EventsClient";

export const metadata: Metadata = {
  title: "Events & Competitions",
  description:
    "Explore the on-stage and off-stage events and competitions at MUDRA 2026, the cultural arts festival of Toc H Institute of Science & Technology, Ernakulam, Kerala.",
};

export default function EventsPage() {
  return <EventsClient />;
}
