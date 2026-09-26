/**
 * Rate Limiter Interface
 * Structured this way so it can be easily swapped for Redis/Upstash in production
 * (e.g., using @upstash/ratelimit) without changing the route handlers.
 */
export interface RateLimiter {
  limit(identifier: string): Promise<{ success: boolean; limit: number; remaining: number; reset: number }>;
}

// Simple in-memory fallback for development/testing or single-instance deployment
// In a serverless environment (like Vercel), this state resets on cold starts.
const store = new Map<string, { count: number; resetTime: number }>();

export class MemoryRateLimiter implements RateLimiter {
  private maxRequests: number;
  private windowMs: number;

  constructor({ maxRequests = 10, windowMs = 60000 }: { maxRequests?: number; windowMs?: number }) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async limit(identifier: string) {
    const now = Date.now();
    const record = store.get(identifier);

    if (!record || record.resetTime < now) {
      store.set(identifier, { count: 1, resetTime: now + this.windowMs });
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

// Export a default instance for general API use
export const apiRateLimiter = new MemoryRateLimiter({ maxRequests: 20, windowMs: 60 * 1000 });
