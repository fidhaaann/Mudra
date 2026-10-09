import { NextRequest } from 'next/server';
import { fetchEvents } from '@/lib/server/google/competition';
import { apiRateLimiter } from '@/lib/server/security/rate-limit';
import { CACHE_STATIC_DATA, jsonOk, rateLimit, upstreamUnavailable } from '@/lib/server/http';

// Caching happens at two levels:
//  1. The per-instance Sheets cache (lib/server/cache.ts): fresh hits,
//     one shared upstream call per burst of misses, last good data on errors.
//  2. The Cache-Control header, so the CDN (Vercel Edge Network) answers most
//     requests without invoking this function at all.
export async function GET(request: NextRequest) {
  const limited = await rateLimit(request, apiRateLimiter);
  if (limited) return limited;

  try {
    const events = await fetchEvents();
    return jsonOk({ events }, CACHE_STATIC_DATA);
  } catch (error) {
    return upstreamUnavailable('Events API Error', 'Failed to fetch events', error);
  }
}
