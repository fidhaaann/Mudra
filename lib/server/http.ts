import { NextRequest, NextResponse } from 'next/server';
import type { RateLimiter } from './security/rate-limit';
import { describeError } from './cache';

/**
 * Shared response helpers for the public API routes, so every route applies
 * the same rate limiting, cache headers and error handling.
 */

/** CDN caching for data that changes rarely (event list, schedule). */
export const CACHE_STATIC_DATA = 'public, s-maxage=60, stale-while-revalidate=300';
/**
 * CDN caching for live data (leaderboard, results, awards): at most ~15 s
 * old under normal load; the CDN may serve a slightly older copy for up to
 * 60 s while it refreshes in the background.
 */
export const CACHE_LIVE_DATA = 'public, s-maxage=15, stale-while-revalidate=60';
/**
 * A fallback copy is being served (Sheets unavailable or slow): let the CDN
 * hold it only briefly so fresh data reappears as soon as Sheets recovers.
 */
export const CACHE_STALE_DATA = 'public, s-maxage=5';
/** Never cache (errors, rate limits, personal lookups). */
export const NO_STORE = 'no-store';

/**
 * Client IP for rate limiting. On Vercel, x-forwarded-for is set by the
 * platform (client-supplied values are overwritten); only its first entry is
 * the client. Behind other proxies this header may be client-controlled, so
 * the limiter must not be treated as a security boundary.
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  if (first) return first.slice(0, 64);
  const realIp = request.headers.get('x-real-ip')?.trim();
  return realIp ? realIp.slice(0, 64) : 'unknown';
}

/** Returns a 429 response when the client is over the limit, else null. */
export async function rateLimit(
  request: NextRequest,
  limiter: RateLimiter
): Promise<NextResponse | null> {
  const result = await limiter.limit(getClientIp(request));
  if (result.success) return null;
  const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: {
        'Cache-Control': NO_STORE,
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.reset),
      },
    }
  );
}

/** 200 JSON with the given Cache-Control policy. */
export function jsonOk(body: unknown, cacheControl: string): NextResponse {
  return NextResponse.json(body, { headers: { 'Cache-Control': cacheControl } });
}

/**
 * The upstream data source (Google Sheets) failed and no cached copy was
 * usable. Logged without the raw error (which may carry credentials) and
 * returned as a retryable 503 with a generic message.
 */
export function upstreamUnavailable(label: string, publicMessage: string, error: unknown): NextResponse {
  console.error(`${label}:`, describeError(error));
  return NextResponse.json(
    { error: publicMessage },
    { status: 503, headers: { 'Cache-Control': NO_STORE, 'Retry-After': '30' } }
  );
}
