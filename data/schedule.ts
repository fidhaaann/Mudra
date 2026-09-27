/**
 * Static venue list used by app/schedule/page.tsx.
 *
 * Actual per-event scheduling data is served at runtime from the EVENTS
 * Google Sheet via GET /api/schedule (lib/server/google/schedule.ts).
 * The SCHEDULE_ITEMS array below stays empty until the schedule page is
 * wired up to the live API.
 */

export type VenueId =
  | "VENUE 01"
  | "VENUE 02"
  | "VENUE 03"
  | "VENUE 04"
  | "VENUE 05";

export interface ScheduleItem {
  id: string;
  eventId: string;
  eventName: string;
  venue: VenueId;
  day: string;
  startTime: string;
  endTime: string;
  category: "on-stage" | "off-stage";
  status: "upcoming" | "live" | "completed";
}

export const VENUES: VenueId[] = [
  "VENUE 01",
  "VENUE 02",
  "VENUE 03",
  "VENUE 04",
  "VENUE 05",
];

/**
 * Placeholder — empty until the schedule page consumes GET /api/schedule.
 */
export const SCHEDULE_ITEMS: ScheduleItem[] = [];
