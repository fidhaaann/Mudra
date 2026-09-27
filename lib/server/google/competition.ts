import { google } from 'googleapis';
import { getGoogleEnvVars } from '../security/env';
import { Event, ParticipantType, PointsCategory, EventStatus } from '@/types/event';
import { EventResult, PodiumPlacement } from '@/types/result';
import { TeamId } from '@/types/team';
import { getPointsForRank } from '@/data/pointRules';

// ─── auth ─────────────────────────────────────────────────────────────────────

export function getSheetsClient() {
  const { email, privateKey } = getGoogleEnvVars();
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

// ─── in-memory cache ──────────────────────────────────────────────────────────
// Prevents redundant Google Sheets round-trips within a short window.
// Serverless cold-starts naturally clear it; the 30-second TTL is the hot-path
// guard for rapid back-to-back requests on the same instance.

const CACHE_TTL_MS = 30_000; // 30 s

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

let eventsCache:  CacheEntry<Event[]>       | null = null;
let resultsCache: CacheEntry<EventResult[]> | null = null;

/**
 * Fetch all events from the EVENTS sheet with a module-level in-memory cache.
 * Multiple callers within the same TTL window share the same resolved data
 * without triggering additional Sheets API calls.
 */
export async function fetchEvents(): Promise<Event[]> {
  const now = Date.now();
  if (eventsCache && eventsCache.expiresAt > now) {
    return eventsCache.data;
  }

  const { competitionSpreadsheetId } = getGoogleEnvVars();
  const sheets = getSheetsClient();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: competitionSpreadsheetId,
      range: 'EVENTS',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      eventsCache = { data: [], expiresAt: now + CACHE_TTL_MS };
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
      });
    }

    eventsCache = { data: events, expiresAt: now + CACHE_TTL_MS };
    return events;
  } catch (error) {
    console.error('Error fetching events from Google Sheets:', error);
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
 * Fetch all results from the RESULTS sheet with a module-level in-memory
 * cache (same 30 s TTL as fetchEvents).
 *
 * Accepts a pre-fetched events array to avoid a redundant fetchEvents() call
 * when the caller already has events in hand (e.g. buildLeaderboard).
 * Defaults to calling fetchEvents() when no argument is supplied.
 */
export async function fetchResults(
  prefetchedEvents?: Event[]
): Promise<EventResult[]> {
  const now = Date.now();
  if (!prefetchedEvents && resultsCache && resultsCache.expiresAt > now) {
    return resultsCache.data;
  }

  const { competitionSpreadsheetId } = getGoogleEnvVars();
  const sheets = getSheetsClient();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: competitionSpreadsheetId,
      range: 'RESULTS',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      if (!prefetchedEvents) {
        resultsCache = { data: [], expiresAt: now + CACHE_TTL_MS };
      }
      return [];
    }

    const headers = rows[0].map((h: string) =>
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
        row.every((cell: string) => !cell || String(cell).trim() === '')
      ) {
        continue;
      }

      const eventId = eventIdIdx >= 0 ? String(row[eventIdIdx] || '').trim() : '';
      if (!eventId) continue;

      const placementStr = placementIdx >= 0 ? String(row[placementIdx] || '').trim() : '';
      const placement    = parseInt(placementStr, 10);
      if (isNaN(placement) || (placement !== 1 && placement !== 2 && placement !== 3)) continue;

      const participantName = participantIdx >= 0 ? String(row[participantIdx] || '').trim() : '';
      const rawTeam = teamIdx >= 0 ? String(row[teamIdx] || '').trim().toLowerCase() : '';
      const teamId  = (['raaga', 'agni', 'tarang', 'utsav'].includes(rawTeam)
        ? rawTeam
        : 'raaga') as TeamId;
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

    // Reuse pre-fetched events (or fetch via cache) — never a second Sheets call
    const events = prefetchedEvents ?? (await fetchEvents());

    // Build a lowercase-keyed Map for O(1) event lookups
    const eventMap = new Map(events.map(e => [e.id.toLowerCase(), e]));

    const results: EventResult[] = [];

    for (const [eventId, placements] of resultsMap.entries()) {
      const event = eventMap.get(eventId.toLowerCase());
      const publishedResult = event
        ? buildPublishedEventResult(event, placements)
        : null;
      if (publishedResult) results.push(publishedResult);
    }

    // Only cache when we used the shared events cache (not a caller-supplied
    // prefetchedEvents snapshot) so the cache stays coherent.
    if (!prefetchedEvents) {
      resultsCache = { data: results, expiresAt: now + CACHE_TTL_MS };
    }

    return results;
  } catch (error) {
    console.error('Error fetching results from Google Sheets:', error);
    throw new Error('Failed to retrieve results.');
  }
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
  return results.find(r => r.eventId === eventId) ?? null;
}
