import { NextRequest, NextResponse } from 'next/server';
import { validateLookupRequest } from '@/lib/server/validation/lookup';
import { findStudentTeam } from '@/lib/server/services/team-lookup';
import { apiRateLimiter } from '@/lib/server/security/rate-limit';

export async function GET(request: NextRequest) {
  // 1. Rate Limiting
  // Use IP as identifier. Note: In Vercel, x-forwarded-for contains the client IP.
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
  const rateLimitResult = await apiRateLimiter.limit(ip);
  
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
        }
      }
    );
  }

  // 2. Input Validation
  const searchParams = request.nextUrl.searchParams;
  const validationResult = validateLookupRequest(searchParams);

  if (validationResult.error || !validationResult.data) {
    return NextResponse.json(
      { error: validationResult.error },
      { status: 400 }
    );
  }

  // 3. Service Layer (Google Sheets Interaction)
  const result = await findStudentTeam(validationResult.data);

  // 4. Response Mapping
  switch (result.type) {
    case 'success':
      return NextResponse.json({ data: result.data }, { status: 200 });
    case 'not_found':
      return NextResponse.json({ error: result.message }, { status: 404 });
    case 'multiple_matches':
      return NextResponse.json({ error: result.message }, { status: 409 });
    case 'error':
      return NextResponse.json({ error: result.message }, { status: 500 });
  }
}
