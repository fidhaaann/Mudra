import { NextRequest } from 'next/server';
import { fetchSchedule } from '@/lib/server/google/schedule';
import { apiRateLimiter } from '@/lib/server/security/rate-limit';
import { CACHE_STALE_DATA, CACHE_STATIC_DATA, jsonOk, rateLimit, upstreamUnavailable } from '@/lib/server/http';

export async function GET(request: NextRequest) {
  const limited = await rateLimit(request, apiRateLimiter);
  if (limited) return limited;

  try {
    const schedule = await fetchSchedule();
    return jsonOk(schedule, schedule.dataStatus === 'live' ? CACHE_STATIC_DATA : CACHE_STALE_DATA);
  } catch (error) {
    return upstreamUnavailable('Schedule API Error', 'Failed to fetch schedule', error);
  }
}
