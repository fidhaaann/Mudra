export type CompetitionCategory = "on-stage" | "off-stage";

export type ParticipantType = "solo" | "duo" | "group";

export type PointsCategory = "solo" | "duo" | "group" | "offstage";

export type EventStatus = "upcoming" | "live" | "completed";

export interface Event {
  id: string;
  name: string;
  category: CompetitionCategory;
  participantType: ParticipantType;
  pointsCategory: PointsCategory;
  description?: string;
  venue?: string;
  schedule?: string;
  status: EventStatus;
  imageUrl?: string;
  registrationLink?: string;
  registrationOpen?: boolean;
  /** DISPLAY_ORDER from the EVENTS sheet: position within the event's category. */
  displayOrder?: number;
}
