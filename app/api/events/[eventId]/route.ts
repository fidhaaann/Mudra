import { NextRequest, NextResponse } from 'next/server';
import { fetchEvent } from '@/lib/server/google/competition';
import { apiRateLimiter } from '@/lib/server/security/rate-limit';
import { CACHE_STATIC_DATA, NO_STORE, jsonOk, rateLimit, upstreamUnavailable } from '@/lib/server/http';

// Allowlist: event IDs are alphanumeric slugs with optional hyphens/underscores.
// Max 100 chars — prevents log injection and pathological input reaching fetchEvent.
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
    const event = await fetchEvent(eventId);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404, headers: { 'Cache-Control': NO_STORE } });
    }
    return jsonOk({ event }, CACHE_STATIC_DATA);
  } catch (error) {
    // eventId is validated above, so it is safe to include in the log label.
    return upstreamUnavailable(`Event API Error [${eventId}]`, 'Failed to fetch event', error);
  }
}
