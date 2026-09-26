import { NextRequest, NextResponse } from 'next/server';
import { buildLeaderboard } from '@/lib/server/google/leaderboard';
import { apiRateLimiter } from '@/lib/server/security/rate-limit';

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

    const leaderboard = await buildLeaderboard();
    return NextResponse.json(leaderboard);
  } catch (error) {
    console.error('Leaderboard API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
