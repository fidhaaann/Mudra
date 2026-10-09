/**
 * Rate Limiter Interface
 * Structured this way so it can be swapped for a shared store (e.g. Upstash
 * Redis via @upstash/ratelimit) without changing the route handlers.
 */
export interface RateLimiter {
  limit(identifier: string): Promise<{ success: boolean; limit: number; remaining: number; reset: number }>;
}

/** Hard cap on tracked identifiers per limiter, so memory stays bounded. */
const MAX_TRACKED_KEYS = 10_000;

/**
 * Fixed-window, in-memory limiter. IMPORTANT: state is per server instance.
 * On serverless platforms (Vercel) every warm instance has its own counters
 * and a cold start resets them, so this is abuse damping, not a global quota.
 * A platform-level rule (Vercel Firewall rate limiting) or a shared store is
 * needed for a true global limit.
 *
 * Limits are deliberately generous: students on campus Wi-Fi share one
 * public IP, so a strict per-IP limit would lock out a whole crowd.
 */
export class MemoryRateLimiter implements RateLimiter {
  private maxRequests: number;
  private windowMs: number;
  private store = new Map<string, { count: number; resetTime: number }>();

  constructor({ maxRequests = 10, windowMs = 60000 }: { maxRequests?: number; windowMs?: number }) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /** Remove expired windows; if still over the cap, drop the oldest entries. */
  private prune(now: number) {
    for (const [key, record] of this.store) {
      if (record.resetTime <= now) this.store.delete(key);
    }
    if (this.store.size >= MAX_TRACKED_KEYS) {
      const excess = this.store.size - MAX_TRACKED_KEYS + 1;
      let removed = 0;
      for (const key of this.store.keys()) {
        if (removed++ >= excess) break;
        this.store.delete(key);
      }
    }
  }

  async limit(identifier: string) {
    const now = Date.now();
    const record = this.store.get(identifier);

    if (!record || record.resetTime <= now) {
      if (!record && this.store.size >= MAX_TRACKED_KEYS) this.prune(now);
      this.store.set(identifier, { count: 1, resetTime: now + this.windowMs });
      return {
        success: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - 1,
        reset: now + this.windowMs,
      };
    }

    if (record.count >= this.maxRequests) {
      return {
        success: false,
        limit: this.maxRequests,
        remaining: 0,
        reset: record.resetTime,
      };
    }

    record.count++;
    return {
      success: true,
      limit: this.maxRequests,
      remaining: this.maxRequests - record.count,
      reset: record.resetTime,
    };
  }
}

/**
 * Public read endpoints (events, schedule, leaderboard, awards, results).
 * Responses are CDN-cached and served from the in-memory Sheets cache, so
 * each request is cheap. Sized from load tests: 250 visitors behind ONE
 * campus IP generate ~4,000 API requests/min, and a 600/min limit rejected
 * half of them. 6,000/min (100 req/s) still stops a single runaway client
 * from monopolising an instance without locking out a shared campus network.
 */
export const apiRateLimiter = new MemoryRateLimiter({ maxRequests: 6_000, windowMs: 60 * 1000 });

/**
 * Team Lookup: not cacheable (personal query) and returns student names, so
 * it is limited more tightly to slow down scraping, while still allowing a
 * few hundred students on one campus IP to look up their house in a minute.
 * Pair with a platform rule (Vercel Firewall) for a true global limit.
 */
export const lookupRateLimiter = new MemoryRateLimiter({ maxRequests: 300, windowMs: 60 * 1000 });
