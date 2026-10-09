import { NextRequest } from 'next/server';
import { fetchAwards } from '@/lib/server/google/awards';
import { apiRateLimiter } from '@/lib/server/security/rate-limit';
import { CACHE_LIVE_DATA, CACHE_STALE_DATA, jsonOk, rateLimit, upstreamUnavailable } from '@/lib/server/http';
import { describeFreshness } from '@/lib/server/cache';
import { AwardsResponse } from '@/types/awards';

export async function GET(request: NextRequest) {
  const limited = await rateLimit(request, apiRateLimiter);
  if (limited) return limited;

  try {
    const awards = await fetchAwards();
    const { dataAsOf, dataStatus } = describeFreshness(['awards']);
    const body: AwardsResponse = { ...awards, lastUpdated: dataAsOf, dataStatus };
    return jsonOk(body, dataStatus === 'live' ? CACHE_LIVE_DATA : CACHE_STALE_DATA);
  } catch (error) {
    return upstreamUnavailable('Awards API Error', 'Failed to fetch awards', error);
  }
}
