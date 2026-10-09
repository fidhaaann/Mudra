import { NextRequest, NextResponse } from 'next/server';
import { fetchEventResults } from '@/lib/server/google/competition';
import { apiRateLimiter } from '@/lib/server/security/rate-limit';
import { CACHE_LIVE_DATA, NO_STORE, jsonOk, rateLimit, upstreamUnavailable } from '@/lib/server/http';

// Allowlist: event IDs are alphanumeric slugs with optional hyphens/underscores.
// Max 100 chars — prevents log injection and pathological input reaching fetchEventResults.
const EVENT_ID_RE = /^[a-zA-Z0-9_-]{1,100}$/;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const limited = await rateLimit(request, apiRateLimiter);
  if (limited) return limited;

  const { eventId } = await params;
  if (!eventId || !EVENT_ID_RE.test(eventId)) {
    return NextResponse.json({ error: 'Invalid event ID.' }, { status: 400, headers: { 'Cache-Control': NO_STORE } });
  }

  try {
    const results = await fetchEventResults(eventId);
    // No published result (event not completed or unknown): an empty list,
    // never invented placements.
    return jsonOk(
      { results: results ?? { eventId, placements: [], isDemoData: false } },
      CACHE_LIVE_DATA
    );
  } catch (error) {
    return upstreamUnavailable(`Event Results API Error [${eventId}]`, 'Failed to fetch event results', error);
  }
}
