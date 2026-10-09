import { NextRequest, NextResponse } from 'next/server';
import { validateLookupRequest } from '@/lib/server/validation/lookup';
import { findStudentTeam } from '@/lib/server/services/team-lookup';
import { lookupRateLimiter } from '@/lib/server/security/rate-limit';
import { NO_STORE, rateLimit } from '@/lib/server/http';

/** Personal results: never stored by the CDN or the browser cache. */
const PRIVATE = { 'Cache-Control': NO_STORE };

export async function GET(request: NextRequest) {
  // 1. Rate limiting (per instance; see lib/server/security/rate-limit.ts)
  const limited = await rateLimit(request, lookupRateLimiter);
  if (limited) return limited;

  // 2. Input validation
  const validationResult = validateLookupRequest(request.nextUrl.searchParams);
  if (validationResult.error || !validationResult.data) {
    return NextResponse.json({ error: validationResult.error }, { status: 400, headers: PRIVATE });
  }

  // 3. Service layer (served from the cached student list)
  const result = await findStudentTeam(validationResult.data);

  // 4. Response mapping
  switch (result.type) {
    case 'success':
      return NextResponse.json({ data: result.data }, { status: 200, headers: PRIVATE });
    case 'candidates':
      // Possible matches carry name/semester/branch only — never the team.
      return NextResponse.json({ matches: result.matches, more: result.more }, { status: 200, headers: PRIVATE });
    case 'query_too_short':
      return NextResponse.json({ error: result.message }, { status: 400, headers: PRIVATE });
    case 'not_found':
      return NextResponse.json({ error: result.message }, { status: 404, headers: PRIVATE });
    case 'multiple_matches':
      return NextResponse.json({ error: result.message }, { status: 409, headers: PRIVATE });
    case 'error':
      // Student data unavailable (Google Sheets down and no cached copy).
      return NextResponse.json(
        { error: result.message },
        { status: 503, headers: { ...PRIVATE, 'Retry-After': '30' } }
      );
  }
}
