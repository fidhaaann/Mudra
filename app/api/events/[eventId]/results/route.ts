import { NextRequest, NextResponse } from 'next/server';
import { fetchEventResults } from '@/lib/server/google/competition';
import { apiRateLimiter } from '@/lib/server/security/rate-limit';

// Allowlist: event IDs are alphanumeric slugs with optional hyphens/underscores.
// Max 100 chars — prevents log injection and pathological input reaching fetchEventResults.
const EVENT_ID_RE = /^[a-zA-Z0-9_-]{1,100}$/;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  // Resolve params once
  const { eventId } = await params;

  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimitResult = await apiRateLimiter.limit(ip);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    if (!eventId || !EVENT_ID_RE.test(eventId)) {
      return NextResponse.json({ error: 'Invalid event ID.' }, { status: 400 });
    }

    const results = await fetchEventResults(eventId);

    if (!results) {
      // Return a 200 with no results if not completed or not found
      return NextResponse.json({
        results: {
          eventId,
          placements: [],
          isDemoData: false,
        },
      });
    }

    return NextResponse.json({ results });
  } catch (error) {
    // Log the sanitized id (already validated above) — never log raw user input
    console.error(`Event Results API Error [${eventId}]:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch event results' },
      { status: 500 }
    );
  }
}
