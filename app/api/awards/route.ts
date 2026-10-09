import { NextRequest } from 'next/server';
import { fetchAwards } from '@/lib/server/google/awards';
import { apiRateLimiter } from '@/lib/server/security/rate-limit';
import { CACHE_LIVE_DATA, jsonOk, rateLimit, upstreamUnavailable } from '@/lib/server/http';
import { AwardsResponse } from '@/types/awards';

export async function GET(request: NextRequest) {
  const limited = await rateLimit(request, apiRateLimiter);
  if (limited) return limited;

  try {
    const awards = await fetchAwards();
    const body: AwardsResponse = { ...awards, lastUpdated: new Date().toISOString() };
    return jsonOk(body, CACHE_LIVE_DATA);
  } catch (error) {
    return upstreamUnavailable('Awards API Error', 'Failed to fetch awards', error);
  }
}
