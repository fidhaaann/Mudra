/**
 * Small server-side cache for Google Sheets reads.
 *
 * Each key holds one value (keys are a fixed set such as "events" or
 * "results", so memory is bounded). For every key it provides:
 *
 *  - Fresh hits: within `ttlMs` the cached value is returned without any
 *    upstream call.
 *  - Request coalescing: concurrent misses for the same key share ONE
 *    in-flight load, so a burst of requests after expiry triggers a single
 *    Google Sheets call instead of hundreds.
 *  - Stale-if-error: if a refresh fails and a previous good value is less
 *    than `staleMs` old, that value is served (and the failure logged)
 *    instead of failing the request. With no usable value the error is
 *    re-thrown — nothing is ever invented.
 *  - Bounded wait when a copy exists: if a refresh is slow, callers that have
 *    an older (still usable) value get it after `maxStaleWaitMs` while the
 *    refresh carries on; the next request picks up the new data.
 *  - Failure back-off: after a failed load, further loads are skipped for
 *    `failureBackoffMs` (stale data is served meanwhile, or the same error is
 *    returned immediately when there is none), so an outage or a quota error
 *    does not turn every request into another upstream call.
 *
 * The cache is per server instance. On serverless platforms each warm
 * instance has its own copy; CDN caching (Cache-Control headers on the API
 * routes) is what limits load across instances.
 */

interface Entry<T> {
  value?: T;
  loadedAt: number;
  expiresAt: number;
  /** Do not start a new load before this time (set after a failed refresh). */
  retryAfter: number;
  /** Last load error, re-thrown during the back-off when there is no value. */
  lastError?: unknown;
  inFlight?: Promise<T>;
}

export interface CacheOptions {
  /** How long a loaded value counts as fresh. */
  ttlMs: number;
  /** How long a value may be served after a failed refresh. */
  staleMs: number;
  /** Pause between refresh attempts once a refresh has failed. */
  failureBackoffMs?: number;
  /**
   * When a usable older value exists, wait at most this long for a refresh
   * before answering with that value. Default 2.5 s.
   */
  maxStaleWaitMs?: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  coalesced: number;
  staleServed: number;
  loadFailures: number;
}

const DEFAULT_FAILURE_BACKOFF_MS = 10_000;
const DEFAULT_MAX_STALE_WAIT_MS = 2_500;

const entries = new Map<string, Entry<unknown>>();
const stats = new Map<string, CacheStats>();

function statsFor(key: string): CacheStats {
  let s = stats.get(key);
  if (!s) {
    s = { hits: 0, misses: 0, coalesced: 0, staleServed: 0, loadFailures: 0 };
    stats.set(key, s);
  }
  return s;
}

/** Counters per cache key (for diagnostics and tests). */
export function getCacheStats(): Record<string, CacheStats> {
  return Object.fromEntries([...stats.entries()].map(([k, v]) => [k, { ...v }]));
}

/** Drop all cached values and counters (tests only). */
export function resetCache(): void {
  entries.clear();
  stats.clear();
}

export async function cachedLoad<T>(
  key: string,
  options: CacheOptions,
  load: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const s = statsFor(key);
  let entry = entries.get(key) as Entry<T> | undefined;
  if (!entry) {
    entry = { loadedAt: 0, expiresAt: 0, retryAfter: 0 };
    entries.set(key, entry as Entry<unknown>);
  }

  const hasValue = entry.value !== undefined;
  const usableStale = hasValue && now - entry.loadedAt < options.staleMs;

  if (hasValue && now < entry.expiresAt) {
    s.hits++;
    return entry.value as T;
  }

  // A recent refresh failed: keep serving the last good value until the
  // back-off ends rather than hammering a failing upstream.
  if (usableStale && now < entry.retryAfter) {
    s.staleServed++;
    return entry.value as T;
  }

  // Cold failure: nothing usable to serve and a load just failed. Fail fast
  // with the same error until the back-off ends.
  if (!usableStale && now < entry.retryAfter && entry.lastError !== undefined) {
    throw entry.lastError;
  }

  if (entry.inFlight) {
    s.coalesced++;
    return usableStale ? raceWithStale(entry.inFlight, entry.value as T, options, s) : entry.inFlight;
  }

  s.misses++;
  const current = entry;
  const promise = (async () => {
    try {
      const value = await load();
      const loadedAt = Date.now();
      current.value = value;
      current.loadedAt = loadedAt;
      current.expiresAt = loadedAt + options.ttlMs;
      current.retryAfter = 0;
      current.lastError = undefined;
      return value;
    } catch (error) {
      s.loadFailures++;
      const failedAt = Date.now();
      current.retryAfter = failedAt + (options.failureBackoffMs ?? DEFAULT_FAILURE_BACKOFF_MS);
      current.lastError = error;
      if (current.value !== undefined && failedAt - current.loadedAt < options.staleMs) {
        s.staleServed++;
        console.warn(`[cache] refresh of "${key}" failed; serving data from ${Math.round((failedAt - current.loadedAt) / 1000)}s ago`, {
          reason: describeError(error),
        });
        return current.value;
      }
      throw error;
    } finally {
      current.inFlight = undefined;
    }
  })();
  current.inFlight = promise;
  // A failure or late result of the background refresh must never surface as
  // an unhandled rejection once the caller has been answered from the copy.
  promise.catch(() => {});
  return usableStale ? raceWithStale(promise, entry.value as T, options, s) : promise;
}

/** Resolve with the refresh if it is quick, else with the older value. */
function raceWithStale<T>(refresh: Promise<T>, stale: T, options: CacheOptions, s: CacheStats): Promise<T> {
  const waitMs = options.maxStaleWaitMs ?? DEFAULT_MAX_STALE_WAIT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const fallback = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      s.staleServed++;
      resolve(stale);
    }, waitMs);
  });
  return Promise.race([refresh, fallback]).finally(() => clearTimeout(timer));
}

/**
 * A log-safe summary of an upstream error. Google API errors carry the full
 * request config — including the `Authorization: Bearer …` header — so the
 * raw error object must never be logged.
 */
export function describeError(error: unknown): { message: string; status?: number; code?: string } {
  if (!(error instanceof Error)) return { message: String(error).slice(0, 200) };
  const e = error as Error & { status?: unknown; code?: unknown; response?: { status?: unknown } };
  const status =
    typeof e.status === 'number' ? e.status :
    typeof e.response?.status === 'number' ? e.response.status :
    typeof e.code === 'number' ? e.code : undefined;
  const code = typeof e.code === 'string' ? e.code : undefined;
  return { message: e.message.slice(0, 200), ...(status !== undefined && { status }), ...(code && { code }) };
}
