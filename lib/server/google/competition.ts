import { getGoogleEnvVars } from '../security/env';
import { cachedLoad, describeError } from '../cache';
import { getSheetsClient } from './client';
import { Event, ParticipantType, PointsCategory, EventStatus } from '@/types/event';
import { EventResult, PodiumPlacement } from '@/types/result';
import { parseTeamId } from '@/data/teams';
import { getPointsForRank } from '@/data/pointRules';

// Shared, memoized client with timeouts and bounded retries (see ./client).
export { getSheetsClient };

// ─── ordering ─────────────────────────────────────────────────────────────────
// One canonical event order for every consumer (events page, schedule, …):
// CATEGORY groups (on-stage first), then DISPLAY_ORDER within the category.
// Events without a DISPLAY_ORDER go last in their category; EVENT_ID is only a
// deterministic tiebreak — sheet row order and names are never used.

const CATEGORY_RANK: Record<Event['category'], number> = { 'on-stage': 0, 'off-stage': 1 };

export function compareEventOrder(a: Event, b: Event): number {
  return (
    CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category] ||
    (a.displayOrder ?? Infinity) - (b.displayOrder ?? Infinity) ||
    a.id.localeCompare(b.id, undefined, { numeric: true })
  );
}

// ─── caching ──────────────────────────────────────────────────────────────────
// Per-instance cache (see ../cache): fresh hits, one shared upstream call per
// burst of misses, and the last good data during a Google outage or quota
// error (bounded by staleMs). Event metadata changes rarely, so it is cached
// longer than results, which drive the live leaderboard.

const EVENTS_CACHE  = { ttlMs: 60_000, staleMs: 60 * 60_000 };
const RESULTS_CACHE = { ttlMs: 30_000, staleMs: 20 * 60_000 };

/**
 * All events from the EVENTS sheet, cached and coalesced. Concurrent callers
 * share one Sheets request; a failed refresh serves the last good list.
 */
export function fetchEvents(): Promise<Event[]> {
  return cachedLoad('events', EVENTS_CACHE, loadEvents);
}

async function loadEvents(): Promise<Event[]> {
  const { competitionSpreadsheetId } = getGoogleEnvVars();
  const sheets = getSheetsClient();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: competitionSpreadsheetId,
      range: 'EVENTS',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    // Normalize headers: lowercase, underscores → spaces, trimmed
    const headers = rows[0].map((h: string) =>
      String(h || '').toLowerCase().replace(/_/g, ' ').trim()
    );

    // Discover column positions once per fetch — resilient to column reordering
    const idIdx       = headers.findIndex(h => h === 'id' || h === 'event id' || h === 'eventid');
    const nameIdx     = headers.findIndex(h => h === 'name' || h === 'event name');
    const categoryIdx = headers.findIndex(h => h === 'category');
    const partTypeIdx = headers.findIndex(h => h === 'participant type' || h === 'participanttype');
    const pointsCatIdx= headers.findIndex(h => h === 'points category' || h === 'pointscategory');
    const descIdx     = headers.findIndex(h => h === 'description');
    const venueIdx    = headers.findIndex(h => h === 'venue');
    const dateIdx     = headers.findIndex(h => h === 'date');
    const startTimeIdx= headers.findIndex(h => h === 'start time' || h === 'starttime');
    const endTimeIdx  = headers.findIndex(h => h === 'end time' || h === 'endtime');
    const scheduleIdx = headers.findIndex(h => h === 'schedule');
    const statusIdx   = headers.findIndex(h => h === 'status');
    const imageIdx    = headers.findIndex(h => h === 'image url' || h === 'imageurl');
    const regLinkIdx  = headers.findIndex(
      h => h === 'registration link' || h === 'registration open'
    );
    const orderIdx    = headers.findIndex(h => h === 'display order' || h === 'displayorder');

    const events: Event[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (
        !row ||
        row.length === 0 ||
        row.every((cell: string) => !cell || String(cell).trim() === '')
      ) {
        continue;
      }

      const id = idIdx >= 0 ? String(row[idIdx] || '').trim() : '';
      if (!id) continue;

      const name        = nameIdx >= 0 ? String(row[nameIdx] || '').trim() : '';
      const rawCategory = categoryIdx >= 0 ? String(row[categoryIdx] || '').trim().toLowerCase() : '';
      const rawPartType = partTypeIdx >= 0 ? String(row[partTypeIdx] || '').trim().toLowerCase() : '';
      const rawPointsCat= pointsCatIdx >= 0
        ? String(row[pointsCatIdx] || '').trim().toLowerCase().replace(/[\s-]/g, '')
        : '';
      const rawStatus   = statusIdx >= 0 ? String(row[statusIdx] || '').trim().toLowerCase() : 'upcoming';

      let schedule = scheduleIdx >= 0 ? String(row[scheduleIdx] || '').trim() : '';
      if (!schedule && dateIdx >= 0 && row[dateIdx]) {
        const dateStr  = String(row[dateIdx]).trim();
        const startStr = startTimeIdx >= 0 ? String(row[startTimeIdx] || '').trim() : '';
        const endStr   = endTimeIdx >= 0   ? String(row[endTimeIdx]   || '').trim() : '';
        schedule = startStr
          ? `${dateStr}, ${startStr}${endStr ? ` - ${endStr}` : ''}`
          : dateStr;
      }

      const rawOrder = orderIdx >= 0 ? Number(String(row[orderIdx] ?? '').trim()) : NaN;

      events.push({
        id,
        name,
        category: (rawCategory === 'off-stage' || rawCategory === 'offstage')
          ? 'off-stage'
          : 'on-stage',
        participantType: (rawPartType === 'duo'
          ? 'duo'
          : rawPartType === 'group'
          ? 'group'
          : 'solo') as ParticipantType,
        pointsCategory: (rawPointsCat === 'group'
          ? 'group'
          : rawPointsCat === 'duo'
          ? 'duo'
          : rawPointsCat === 'offstage'
          ? 'offstage'
          : 'solo') as PointsCategory,
        description:
          descIdx >= 0 && row[descIdx] ? String(row[descIdx]).trim() : undefined,
        venue:
          venueIdx >= 0 && row[venueIdx] ? String(row[venueIdx]).trim() : undefined,
        schedule: schedule || undefined,
        status: (rawStatus === 'completed'
          ? 'completed'
          : rawStatus === 'finished'
          ? 'completed'
          : rawStatus === 'live'
          ? 'live'
          : 'upcoming') as EventStatus,
        imageUrl:
          imageIdx >= 0 && row[imageIdx] ? String(row[imageIdx]).trim() : undefined,
        registrationLink:
          regLinkIdx >= 0 && row[regLinkIdx]
            ? String(row[regLinkIdx]).trim()
            : undefined,
        registrationOpen:
          regLinkIdx >= 0
            ? Boolean(
                row[regLinkIdx] &&
                String(row[regLinkIdx]).trim() !== '' &&
                String(row[regLinkIdx]).toLowerCase() !== 'false'
              )
            : false,
        displayOrder:
          orderIdx >= 0 && String(row[orderIdx] ?? '').trim() !== '' && Number.isFinite(rawOrder)
            ? rawOrder
            : undefined,
      });
    }

    events.sort(compareEventOrder);

    return events;
  } catch (error) {
    // Never log the raw error: Google API errors carry the auth header.
    console.error('Error fetching events from Google Sheets:', describeError(error));
    throw new Error('Failed to retrieve events.');
  }
}

/**
 * Return a single event by id.
 * Reuses the cached fetchEvents() result — does NOT issue a separate Sheets call.
 */
export async function fetchEvent(eventId: string): Promise<Event | null> {
  const events = await fetchEvents();
  const lower = eventId.toLowerCase();
  return events.find(e => e.id.toLowerCase() === lower) ?? null;
}

// ─── results ──────────────────────────────────────────────────────────────────

/**
 * Published results for completed events.
 *
 * The parsed RESULTS rows are cached (and coalesced) separately from events;
 * publication is re-derived on every call from the current event list, so a
 * status change in EVENTS takes effect as soon as the events cache refreshes.
 * Pass `prefetchedEvents` to reuse an events list the caller already has.
 */
export async function fetchResults(
  prefetchedEvents?: Event[]
): Promise<EventResult[]> {
  const [resultsMap, events] = await Promise.all([
    cachedLoad('results', RESULTS_CACHE, loadResultRows),
    prefetchedEvents ?? fetchEvents(),
  ]);

  // Build a lowercase-keyed Map for O(1) event lookups
  const eventMap = new Map(events.map(e => [e.id.toLowerCase(), e]));

  const results: EventResult[] = [];
  for (const [eventId, placements] of resultsMap.entries()) {
    // Results for unknown (e.g. deleted) events are never published.
    const event = eventMap.get(eventId.toLowerCase());
    const publishedResult = event
      ? buildPublishedEventResult(event, placements)
      : null;
    if (publishedResult) results.push(publishedResult);
  }
  return results;
}

async function loadResultRows(): Promise<Map<string, PodiumPlacement[]>> {
  const { competitionSpreadsheetId } = getGoogleEnvVars();
  const sheets = getSheetsClient();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: competitionSpreadsheetId,
      range: 'RESULTS',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return new Map();
    return parseResultRows(rows as unknown[][]);
  } catch (error) {
    console.error('Error fetching results from Google Sheets:', describeError(error));
    throw new Error('Failed to retrieve results.');
  }
}

/**
 * Parse RESULTS rows (header row first) into placements grouped by event id.
 * Pure, so the row-to-team mapping can be tested without Google Sheets.
 * Rows without an event id, a 1-3 POSITION or a recognised TEAM are skipped.
 */
export function parseResultRows(rows: unknown[][]): Map<string, PodiumPlacement[]> {
  const headers = (rows[0] ?? []).map((h) =>
    String(h || '').toLowerCase().replace(/_/g, ' ').trim()
  );

  const eventIdIdx   = headers.findIndex(
    h => h === 'event id' || h === 'eventid' || h === 'event'
  );
  const placementIdx = headers.findIndex(
    h => h === 'position' || h === 'placement' || h === 'rank'
  );
  const participantIdx = headers.findIndex(
    h =>
      h === 'entry name' ||
      h === 'entryname' ||
      h === 'participant' ||
      h === 'participant name' ||
      h === 'name'
  );
  const teamIdx  = headers.findIndex(h => h === 'team' || h === 'team id');
  const resultsMap = new Map<string, PodiumPlacement[]>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (
      !row ||
      row.length === 0 ||
      row.every((cell) => !cell || String(cell).trim() === '')
    ) {
      continue;
    }

    const eventId = eventIdIdx >= 0 ? String(row[eventIdIdx] || '').trim() : '';
    if (!eventId) continue;

    const placementStr = placementIdx >= 0 ? String(row[placementIdx] || '').trim() : '';
    const placement    = parseInt(placementStr, 10);
    if (isNaN(placement) || (placement !== 1 && placement !== 2 && placement !== 3)) continue;

    const participantName = participantIdx >= 0 ? String(row[participantIdx] || '').trim() : '';
    // A placement only counts for a recognised team. Blank or unknown TEAM
    // cells are skipped: the sheet pre-fills POSITION for every result row,
    // so defaulting them to a team would hand that team points.
    const teamId = parseTeamId(teamIdx >= 0 ? row[teamIdx] : '');
    if (!teamId) continue;
    const placementObj: PodiumPlacement = {
      placement: placement as 1 | 2 | 3,
      participantOrTeamName: participantName,
      teamId,
      pointsAwarded: 0,
    };

    const existing = resultsMap.get(eventId) ?? [];
    existing.push(placementObj);
    resultsMap.set(eventId, existing);
  }

  return resultsMap;
}

/**
 * Publishes only completed-event results and derives points from the
 * authoritative event category rules. Sheet POINTS values are never used.
 */
export function buildPublishedEventResult(
  event: Event,
  placements: PodiumPlacement[]
): EventResult | null {
  if (event.status !== 'completed') return null;

  return {
    eventId: event.id,
    placements: [...placements]
      .sort((a, b) => a.placement - b.placement)
      .map((placement) => ({
        ...placement,
        pointsAwarded: getPointsForRank(event.pointsCategory, placement.placement),
      })),
    isDemoData: false,
  };
}

/**
 * Return results for a single event.
 * Reuses fetchResults() which itself reuses the events cache.
 */
export async function fetchEventResults(eventId: string): Promise<EventResult | null> {
  const results = await fetchResults();
  // Same case-insensitive match as fetchEvent, so /events/e001 and /events/E001 agree.
  const lower = eventId.toLowerCase();
  return results.find(r => r.eventId.toLowerCase() === lower) ?? null;
}
