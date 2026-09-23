import { CompetitionCategory, EventStatus } from "./event";

export type VenueId = "VENUE 01" | "VENUE 02" | "VENUE 03" | "VENUE 04" | "VENUE 05";

export interface ScheduleItem {
  id: string;
  eventId: string;
  eventName: string;
  venue: VenueId;
  day: string;
  startTime: string;
  endTime: string;
  category: CompetitionCategory;
  status: EventStatus;
}
