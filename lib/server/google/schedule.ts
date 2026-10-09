import { fetchEvents } from './competition';
import { describeFreshness } from '../cache';
import {
  CompetitionCategory,
  ParticipantType,
  PointsCategory,
  EventStatus,
  Event,
} from '@/types/event';
import { ScheduledEvent, ScheduleResponse } from '@/types/schedule';

// ─── helpers ──────────────────────────────────────────────────────────────────

function toCategory(raw: string | undefined): CompetitionCategory {
  if (!raw) return 'on-stage';
  const lower = raw.toLowerCase().replace(/[\s_]/g, '-');
  return lower === 'off-stage' || lower === 'offstage' ? 'off-stage' : 'on-stage';
}

function toParticipantType(raw: string | undefined): ParticipantType {
  if (!raw) return 'solo';
  const lower = raw.toLowerCase().trim();
  if (lower === 'duo') return 'duo';
  if (lower === 'group') return 'group';
  return 'solo';
}

function toPointsCategory(raw: string | undefined): PointsCategory {
  if (!raw) return 'solo';
  const lower = raw.toLowerCase().replace(/[\s_-]/g, '');
  if (lower === 'group') return 'group';
  if (lower === 'duo') return 'duo';
  if (lower === 'offstage') return 'offstage';
  return 'solo';
}

function toStatus(raw: string | undefined): EventStatus {
  if (!raw) return 'upcoming';
  const lower = raw.toLowerCase().trim();
  if (lower === 'completed') return 'completed';
  if (lower === 'live') return 'live';
  return 'upcoming';
}

/** Sort key: lexicographic chronological order by date then startTime. */
function sortKey(date: string | null, startTime: string | null): string {
  return `${date ?? ''}|${startTime ?? ''}`;
}

// ─── projection ───────────────────────────────────────────────────────────────

/**
 * Project an Event (from the competition sheet) into a ScheduledEvent.
 *
 * The Event type's `schedule` field is a pre-built string ("date, HH:MM - HH:MM").
 * For ScheduledEvent we want the raw sub-fields.  Since `competition.ts` already
 * reads date / startTime / endTime individually into the `schedule` string but
 * does not surface them as separate fields on the Event type, we accept null for
 * those values here — they will be populated once the sheet has schedule data and
 * the Event type is extended, or can be parsed from event.schedule if needed.
 *
 * venue and status come directly from the Event fields that competition.ts already
 * reads.  All other fields (eventId, name, category, participantType, pointsCategory)
 * are exact copies.
 */
function projectEvent(event: Event): ScheduledEvent {
  // Parse date/startTime/endTime out of the pre-built `schedule` string if present.
  // Format written by competition.ts: "DATE, START_TIME - END_TIME"
  //                                or "DATE, START_TIME"
  //                                or "DATE"
  let date:      string | null = null;
  let startTime: string | null = null;
  let endTime:   string | null = null;

  if (event.schedule) {
    const commaParts = event.schedule.split(',');
    date = commaParts[0].trim() || null;
    if (commaParts.length > 1) {
      const timePart = commaParts.slice(1).join(',').trim();
      const dashIdx  = timePart.indexOf(' - ');
      if (dashIdx !== -1) {
        startTime = timePart.slice(0, dashIdx).trim() || null;
        endTime   = timePart.slice(dashIdx + 3).trim() || null;
      } else {
        startTime = timePart || null;
      }
    }
  }

  return {
    eventId:         event.id,
    name:            event.name,
    category:        toCategory(event.category),
    participantType: toParticipantType(event.participantType),
    pointsCategory:  toPointsCategory(event.pointsCategory),
    date,
    startTime,
    endTime,
    venue:           event.venue ?? null,
    status:          toStatus(event.status),
    displayOrder:    event.displayOrder ?? null,
  };
}

// ─── main export ─────────────────────────────────────────────────────────────

/**
 * Build a ScheduleResponse by projecting the cached Event list.
 *
 * Reuses fetchEvents() (which has its own 30 s in-memory cache) so no
 * additional Google Sheets API call is made unless the events cache is cold.
 * This eliminates the redundant EVENTS sheet read that the previous standalone
 * implementation issued on every /api/schedule request.
 */
export async function fetchSchedule(): Promise<ScheduleResponse> {
  const events = await fetchEvents();
  const freshness = describeFreshness(['events']);

  const scheduled:   ScheduledEvent[] = [];
  const unscheduled: ScheduledEvent[] = [];

  for (const event of events) {
    const item = projectEvent(event);
    if (item.date !== null) {
      scheduled.push(item);
    } else {
      unscheduled.push(item);
    }
  }

  // Scheduled events: date → startTime → DISPLAY_ORDER. The input is already in
  // canonical (category → DISPLAY_ORDER) order and Array.sort is stable, so
  // unscheduled events — and any remaining ties — keep that order.
  scheduled.sort((a, b) =>
    sortKey(a.date, a.startTime).localeCompare(sortKey(b.date, b.startTime)) ||
    (a.displayOrder ?? Infinity) - (b.displayOrder ?? Infinity)
  );

  return {
    events:           [...scheduled, ...unscheduled],
    lastUpdated:      freshness.dataAsOf,
    dataStatus:       freshness.dataStatus,
    scheduledCount:   scheduled.length,
    unscheduledCount: unscheduled.length,
  };
}
