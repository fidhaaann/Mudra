import { NextRequest, NextResponse } from 'next/server';
import { fetchEvents } from '@/lib/server/google/competition';
import { apiRateLimiter } from '@/lib/server/security/rate-limit';

// This route reads request.headers for IP-based rate limiting, which makes it
// a dynamic route.  `export const revalidate` has no effect on dynamic routes
// that access headers, so it is omitted here.  Caching is handled at two levels:
//
//  1. The module-level in-memory cache in competition.ts (30 s TTL) prevents
//     redundant Google Sheets calls across rapid back-to-back requests on the
//     same serverless instance.
//
//  2. The Cache-Control response header below instructs edge CDNs (Vercel Edge
//     Network, Cloudflare, etc.) to serve the response from cache for up to
//     60 seconds and allow stale serving for up to 5 minutes while revalidating.

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimitResult = await apiRateLimiter.limit(ip);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const events = await fetchEvents();
    return NextResponse.json(
      { events },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    console.error('Events API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}
