import { NextRequest, NextResponse } from 'next/server';
import { fetchAwards } from '@/lib/server/google/awards';
import { apiRateLimiter } from '@/lib/server/security/rate-limit';
import { AwardsResponse } from '@/types/awards';

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

    const awards = await fetchAwards();
    const body: AwardsResponse = { ...awards, lastUpdated: new Date().toISOString() };
    return NextResponse.json(body);
  } catch (error) {
    console.error('Awards API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch awards' },
      { status: 500 }
    );
  }
}
