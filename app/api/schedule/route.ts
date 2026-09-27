import { NextRequest, NextResponse } from 'next/server';
import { fetchSchedule } from '@/lib/server/google/schedule';
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

    const schedule = await fetchSchedule();
    return NextResponse.json(schedule);
  } catch (error) {
    console.error('Schedule API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedule' },
      { status: 500 }
    );
  }
}
