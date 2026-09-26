import { NextRequest, NextResponse } from 'next/server';
import { fetchEventResults } from '@/lib/server/google/competition';
import { apiRateLimiter } from '@/lib/server/security/rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimitResult = await apiRateLimiter.limit(ip);
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const { eventId } = await params;
    
    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    const results = await fetchEventResults(eventId);
    
    if (!results) {
      // Return a 200 with no results if not completed or not found
      return NextResponse.json({ 
        results: {
          eventId,
          placements: [],
          isDemoData: false
        }
      });
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error(`Event Results API Error [${(await params).eventId}]:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch event results' },
      { status: 500 }
    );
  }
}
