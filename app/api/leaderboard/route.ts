import { NextRequest } from 'next/server';
import { buildLeaderboard } from '@/lib/server/google/leaderboard';
import { apiRateLimiter } from '@/lib/server/security/rate-limit';
import { CACHE_LIVE_DATA, CACHE_STALE_DATA, jsonOk, rateLimit, upstreamUnavailable } from '@/lib/server/http';

export async function GET(request: NextRequest) {
  const limited = await rateLimit(request, apiRateLimiter);
  if (limited) return limited;

  try {
    const leaderboard = await buildLeaderboard();
    return jsonOk(leaderboard, leaderboard.dataStatus === 'live' ? CACHE_LIVE_DATA : CACHE_STALE_DATA);
  } catch (error) {
    // No usable data: fail honestly (never return fabricated zero scores).
    return upstreamUnavailable('Leaderboard API Error', 'Failed to fetch leaderboard', error);
  }
}
