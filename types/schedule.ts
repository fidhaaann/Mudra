import { CompetitionCategory, ParticipantType, PointsCategory, EventStatus } from "./event";

/**
 * A single event as returned by GET /api/schedule.
 *
 * - Scheduled events have non-null date, startTime, endTime, venue, displayOrder.
 * - Unscheduled events carry null for every schedule field; they are included so
 *   the frontend can show "scheduling information not yet published" rather than
 *   silently hiding the event.
 */
export interface ScheduledEvent {
  eventId: string;
  name: string;
  category: CompetitionCategory;
  participantType: ParticipantType;
  /** Maps to the pointsCategory column on the EVENTS sheet. */
  pointsCategory: PointsCategory;
  /** ISO date string (YYYY-MM-DD) or null when not yet published. */
  date: string | null;
  /** Human-readable time string (e.g. "10:00 AM") or null. */
  startTime: string | null;
  /** Human-readable time string (e.g. "11:30 AM") or null. */
  endTime: string | null;
  /** Venue name/label from the sheet, or null. */
  venue: string | null;
  status: EventStatus;
  /**
   * DISPLAY_ORDER from the sheet, or null when the sheet leaves it blank.
   * Scheduled events are sorted: date → startTime → displayOrder.
   * Unscheduled events follow all scheduled events in the canonical event
   * order (category → displayOrder).
   */
  displayOrder: number | null;
}

export interface ScheduleResponse {
  /** All events from the EVENTS sheet, scheduled ones first. */
  events: ScheduledEvent[];
  /** ISO timestamp of when this response was generated. */
  lastUpdated: string;
  /** Number of events that have at least a date value. */
  scheduledCount: number;
  /** Number of events without any scheduling information. */
  unscheduledCount: number;
}
