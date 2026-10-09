/**
 * MUDRA 2026 — Resilience: Sheets cache, error logging, rate limiting
 * ====================================================================
 * Self-contained test file using Node's built-in assert module.
 * Run with:  npx tsx __tests__/resilience.test.ts
 *
 * No Google Sheets calls are made; upstream loads are in-process fakes.
 */

import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { cachedLoad, describeError, getCacheStats, resetCache } from "../lib/server/cache";
import { MemoryRateLimiter } from "../lib/server/security/rate-limit";
import { getClientIp } from "../lib/server/http";

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗  ${name}\n     ${msg}`);
    failed++;
    failures.push(`${name}: ${msg}`);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Silence the expected "[cache] refresh failed" warnings inside a test. */
async function quietly<T>(fn: () => Promise<T>): Promise<T> {
  const warn = console.warn;
  console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.warn = warn;
  }
}

async function main() {
  console.log("\n── Sheets cache ──────────────────────────────────────────────");

  await test("fresh value is served without calling the loader again", async () => {
    resetCache();
    let calls = 0;
    const load = async () => { calls++; return ["e1"]; };
    const opts = { ttlMs: 1_000, staleMs: 10_000 };
    assert.deepEqual(await cachedLoad("k", opts, load), ["e1"]);
    assert.deepEqual(await cachedLoad("k", opts, load), ["e1"]);
    assert.equal(calls, 1);
  });

  await test("500 concurrent misses share ONE upstream call (coalescing)", async () => {
    resetCache();
    let calls = 0;
    const load = async () => { calls++; await sleep(30); return 42; };
    const opts = { ttlMs: 1_000, staleMs: 10_000 };
    const values = await Promise.all(Array.from({ length: 500 }, () => cachedLoad("burst", opts, load)));
    assert.equal(calls, 1);
    assert.ok(values.every((v) => v === 42));
    assert.equal(getCacheStats().burst.coalesced, 499);
  });

  await test("failed refresh serves the last good value (stale-if-error)", async () => {
    resetCache();
    let fail = false;
    let calls = 0;
    const load = async () => { calls++; if (fail) throw new Error("quota exceeded"); return "v1"; };
    const opts = { ttlMs: 10, staleMs: 10_000, failureBackoffMs: 5_000 };
    assert.equal(await cachedLoad("s", opts, load), "v1");
    await sleep(20);
    fail = true;
    assert.equal(await quietly(() => cachedLoad("s", opts, load)), "v1");
    // During the back-off no new upstream call is made.
    assert.equal(await cachedLoad("s", opts, load), "v1");
    assert.equal(await cachedLoad("s", opts, load), "v1");
    assert.equal(calls, 2);
    assert.equal(getCacheStats().s.staleServed, 3);
  });

  await test("recovers with fresh data after the back-off ends", async () => {
    resetCache();
    let value = "old";
    let fail = false;
    const load = async () => { if (fail) throw new Error("down"); return value; };
    const opts = { ttlMs: 10, staleMs: 10_000, failureBackoffMs: 30 };
    await cachedLoad("r", opts, load);
    await sleep(20);
    fail = true;
    assert.equal(await quietly(() => cachedLoad("r", opts, load)), "old");
    fail = false;
    value = "new";
    await sleep(40);
    assert.equal(await cachedLoad("r", opts, load), "new");
  });

  await test("no cached value + failure → error (never invented data), then fail-fast", async () => {
    resetCache();
    let calls = 0;
    const load = async (): Promise<number> => { calls++; throw new Error("Failed to retrieve events."); };
    const opts = { ttlMs: 1_000, staleMs: 10_000, failureBackoffMs: 5_000 };
    await assert.rejects(cachedLoad("cold", opts, load), /Failed to retrieve events/);
    await assert.rejects(cachedLoad("cold", opts, load), /Failed to retrieve events/);
    await assert.rejects(cachedLoad("cold", opts, load), /Failed to retrieve events/);
    assert.equal(calls, 1, "back-off must stop repeated upstream calls");
  });

  await test("data older than staleMs is not served after a failure", async () => {
    resetCache();
    let fail = false;
    const load = async () => { if (fail) throw new Error("down"); return "v"; };
    const opts = { ttlMs: 5, staleMs: 15, failureBackoffMs: 1 };
    await cachedLoad("old", opts, load);
    await sleep(30);
    fail = true;
    await assert.rejects(cachedLoad("old", opts, load), /down/);
  });

  await test("slow refresh: callers get the older copy after maxStaleWaitMs, then the new data", async () => {
    resetCache();
    let slow = false;
    let version = 1;
    const load = async () => {
      if (slow) await sleep(150);
      return `v${version}`;
    };
    const opts = { ttlMs: 5, staleMs: 10_000, maxStaleWaitMs: 20 };
    assert.equal(await cachedLoad("slow", opts, load), "v1");
    await sleep(10);
    slow = true;
    version = 2;
    const t0 = Date.now();
    assert.equal(await cachedLoad("slow", opts, load), "v1");
    assert.ok(Date.now() - t0 < 100, "must not wait for the slow refresh");
    await sleep(200);
    slow = false;
    assert.equal(await cachedLoad("slow", opts, load), "v2", "refresh result is used once it lands");
  });

  console.log("\n── Error logging ─────────────────────────────────────────────");

  await test("describeError never includes request headers or tokens", () => {
    const err = Object.assign(new Error("Request failed with status code 429"), {
      status: 429,
      config: { headers: { Authorization: "Bearer ya29.SECRET-TOKEN" }, url: "https://sheets.googleapis.com/x" },
      response: { status: 429, data: { error: "RESOURCE_EXHAUSTED" } },
    });
    const summary = describeError(err);
    assert.equal(summary.status, 429);
    assert.equal(JSON.stringify(summary).includes("SECRET"), false);
    assert.equal(JSON.stringify(summary).includes("Bearer"), false);
  });

  console.log("\n── Rate limiting ─────────────────────────────────────────────");

  await test("limiter allows up to the limit, then rejects", async () => {
    const limiter = new MemoryRateLimiter({ maxRequests: 3, windowMs: 60_000 });
    const outcomes = [];
    for (let i = 0; i < 5; i++) outcomes.push((await limiter.limit("1.2.3.4")).success);
    assert.deepEqual(outcomes, [true, true, true, false, false]);
  });

  await test("separate limiters keep separate counters", async () => {
    const a = new MemoryRateLimiter({ maxRequests: 1, windowMs: 60_000 });
    const b = new MemoryRateLimiter({ maxRequests: 1, windowMs: 60_000 });
    assert.equal((await a.limit("ip")).success, true);
    assert.equal((await b.limit("ip")).success, true, "b must not see a's usage");
  });

  await test("tracked identifiers stay bounded under many unique IPs", async () => {
    const limiter = new MemoryRateLimiter({ maxRequests: 5, windowMs: 60_000 });
    for (let i = 0; i < 12_000; i++) await limiter.limit(`10.0.${i >> 8}.${i & 255}-${i}`);
    const size = (limiter as unknown as { store: Map<string, unknown> }).store.size;
    assert.ok(size <= 10_000, `store grew to ${size}`);
  });

  await test("client IP is the first x-forwarded-for entry", () => {
    const req = new NextRequest("http://localhost/api/events", {
      headers: { "x-forwarded-for": " 203.0.113.7 , 10.0.0.1" },
    });
    assert.equal(getClientIp(req), "203.0.113.7");
    assert.equal(getClientIp(new NextRequest("http://localhost/")), "unknown");
  });

  console.log(`\n${"═".repeat(64)}`);
  console.log(`  Resilience — ${passed + failed} tests total`);
  console.log(`  ✓ PASSED: ${passed}`);
  if (failed > 0) {
    console.log(`  ✗ FAILED: ${failed}`);
    failures.forEach((f) => console.error(`    • ${f}`));
    process.exit(1);
  } else {
    console.log("  All tests passed.\n");
  }
}

main();
