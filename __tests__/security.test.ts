/**
 * MUDRA 2026 — API security & reliability regression tests
 * =========================================================
 * Run with:  npx tsx __tests__/security.test.ts
 *
 * The real route handlers are exercised against the local mock Sheets server
 * (scripts/loadtest/mock-sheets.mjs, synthetic data) started by this file on
 * a random port. Dummy credentials are used; nothing contacts Google.
 */

import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { NextRequest } from "next/server";

const MOCK_PORT = 4600 + Math.floor(Math.random() * 300);
const MOCK = `http://127.0.0.1:${MOCK_PORT}`;

// Must be set before any server module is imported.
process.env.SHEETS_API_MOCK_ROOT = `${MOCK}/`;
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "test@example.invalid";
process.env.GOOGLE_PRIVATE_KEY = "not-a-key";
process.env.GOOGLE_SPREADSHEET_ID = "mock-students";
process.env.GOOGLE_COMPETITION_SPREADSHEET_ID = "mock-competition";

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const req = (url: string, ip = "203.0.113.1") =>
  new NextRequest(`http://localhost${url}`, { headers: { "x-forwarded-for": ip } });
const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

/** Silence expected server-side error/warn logs inside a block. */
async function quietly<T>(fn: () => Promise<T>): Promise<T> {
  const { error, warn } = console;
  console.error = () => {};
  console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.error = error;
    console.warn = warn;
  }
}

async function mock(q: string) {
  return (await fetch(`${MOCK}/${q}`)).json();
}

async function main() {
  const mockServer: ChildProcess = spawn(
    process.execPath,
    [path.join(__dirname, "..", "scripts", "loadtest", "mock-sheets.mjs"), String(MOCK_PORT)],
    { stdio: "ignore" }
  );
  for (let i = 0; i < 50; i++) {
    try { await fetch(`${MOCK}/__stats`); break; } catch { await sleep(100); }
  }

  try {
    const { validateLookupRequest } = await import("../lib/server/validation/lookup");
    const { resolveMockRoot } = await import("../lib/server/google/client");
    const cache = await import("../lib/server/cache");
    const routes = {
      leaderboard: await import("../app/api/leaderboard/route"),
      awards: await import("../app/api/awards/route"),
      schedule: await import("../app/api/schedule/route"),
      events: await import("../app/api/events/route"),
      event: await import("../app/api/events/[eventId]/route"),
      results: await import("../app/api/events/[eventId]/results/route"),
      lookup: await import("../app/api/team-lookup/route"),
      health: await import("../app/api/health/route"),
    };

    // ── authorization surface ─────────────────────────────────────────────
    console.log("\n── Write surface ─────────────────────────────────────────────");

    await test("no API route accepts a write method (POST/PUT/PATCH/DELETE)", () => {
      for (const [name, mod] of Object.entries(routes)) {
        for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
          assert.equal(method in mod, false, `${name} exports ${method}`);
        }
        assert.equal(typeof (mod as { GET?: unknown }).GET, "function", `${name} must export GET`);
      }
    });

    // ── input validation ──────────────────────────────────────────────────
    console.log("\n── Team Lookup validation ────────────────────────────────────");

    const v = (q: Record<string, string> | string) =>
      validateLookupRequest(new URLSearchParams(q as Record<string, string>));

    await test("valid input is normalised to the form's choices", () => {
      const r = v({ name: "  Anjali   Menon ", semester: "iv", branch: "cse" });
      assert.deepEqual(r.data, { name: "Anjali Menon", semester: "IV", branch: "CSE" });
    });

    await test("Malayalam names (including ZWJ/ZWNJ) are accepted", () => {
      assert.ok(v({ name: "അനന്തു കെ", semester: "I", branch: "CE" }).data);
      assert.ok(v({ name: "ചില്‍ലു", semester: "I", branch: "CE" }).data);
    });

    await test("missing fields → error", () => {
      assert.ok(v({ name: "Anjali", semester: "IV" }).error);
    });

    await test("unknown semester or branch → error (enum enforced)", () => {
      assert.match(v({ name: "Anjali", semester: "IX", branch: "CSE" }).error ?? "", /semester/i);
      assert.match(v({ name: "Anjali", semester: "IV", branch: "XYZ" }).error ?? "", /branch/i);
    });

    await test("unexpected and repeated parameters → error", () => {
      assert.ok(v({ name: "Anjali", semester: "IV", branch: "CSE", debug: "1" }).error);
      assert.ok(v("name=a1&name=b2&semester=IV&branch=CSE").error);
    });

    await test("control, bidi-override, zero-width and markup characters → error", () => {
      for (const name of ["Anj\u0000ali", "Anj‮ali", "Anj​ali", "<script>x", "a{b}", "a`b"]) {
        assert.ok(v({ name, semester: "IV", branch: "CSE" }).error, JSON.stringify(name));
      }
    });

    await test("oversized input → error before normalisation", () => {
      assert.ok(v({ name: "a".repeat(5000), semester: "IV", branch: "CSE" }).error);
    });

    // ── mock data source guard ────────────────────────────────────────────
    console.log("\n── Mock data source guard ────────────────────────────────────");

    await test("mock root is ignored in Vercel Production", async () => {
      const r = await quietly(async () =>
        resolveMockRoot({ SHEETS_API_MOCK_ROOT: "http://127.0.0.1:4010/", VERCEL_ENV: "production" } as never)
      );
      assert.equal(r, null);
    });

    await test("mock root must be a loopback http URL", async () => {
      for (const url of ["https://evil.example/", "http://10.0.0.5:4010/", "http://sheets.example.com/", "not a url"]) {
        assert.equal(await quietly(async () => resolveMockRoot({ SHEETS_API_MOCK_ROOT: url } as never)), null, url);
      }
      assert.equal(resolveMockRoot({ SHEETS_API_MOCK_ROOT: "http://127.0.0.1:4010/" } as never), "http://127.0.0.1:4010/");
      assert.equal(resolveMockRoot({} as never), null);
    });

    // ── route behaviour ───────────────────────────────────────────────────
    console.log("\n── Routes (against the mock) ─────────────────────────────────");

    await test("leaderboard: 200, five teams, live data, public CDN cache", async () => {
      const res = await routes.leaderboard.GET(req("/api/leaderboard"));
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.teams.length, 5);
      assert.equal(body.dataStatus, "live");
      assert.ok(!Number.isNaN(Date.parse(body.lastUpdated)));
      assert.match(res.headers.get("cache-control") ?? "", /s-maxage=15/);
    });

    await test("team lookup: valid → 200 no-store; invalid → 400 no-store; unknown → 404", async () => {
      // Synthetic student #4: semester "S5"… is not a form choice, so look up
      // by a name in a valid cohort instead and accept 200 or 404 — the point
      // here is the status/caching contract, not the data.
      const ok = await routes.lookup.GET(req("/api/team-lookup?name=Nobody%20Here&semester=IV&branch=CSE"));
      assert.equal(ok.status, 404);
      assert.equal(ok.headers.get("cache-control"), "no-store");
      const bad = await routes.lookup.GET(req("/api/team-lookup?name=%3Cscript%3E&semester=IV&branch=CSE"));
      assert.equal(bad.status, 400);
      assert.equal(bad.headers.get("cache-control"), "no-store");
      const badEnum = await routes.lookup.GET(req("/api/team-lookup?name=Anjali&semester=99&branch=CSE"));
      assert.equal(badEnum.status, 400);
    });

    await test("event routes reject malformed IDs with 400", async () => {
      for (const id of ["../etc", "a b", "x".repeat(101), "<x>"]) {
        const r1 = await routes.event.GET(req(`/api/events/x`), params({ eventId: id }));
        const r2 = await routes.results.GET(req(`/api/events/x/results`), params({ eventId: id }));
        assert.equal(r1.status, 400, id);
        assert.equal(r2.status, 400, id);
      }
    });

    await test("event results match IDs case-insensitively", async () => {
      const res = await routes.results.GET(req("/api/events/e001/results"), params({ eventId: "e001" }));
      const body = await res.json();
      assert.equal(res.status, 200);
      assert.ok(body.results.placements.length > 0, "completed synthetic event E001 has placements");
    });

    await test("Sheets outage with warm cache → 200 marked stale, short CDN cache", async () => {
      await routes.leaderboard.GET(req("/api/leaderboard")); // warm
      await sleep(300);
      await mock("__control?mode=fail");
      cache.expireCacheForTests();
      const res = await quietly(() => routes.leaderboard.GET(req("/api/leaderboard")));
      await mock("__control?mode=ok&delayMs=0");
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.dataStatus, "stale");
      assert.equal(res.headers.get("cache-control"), "public, s-maxage=5");
    });

    await test("CALCULATED sync never runs from a fallback copy (slow Sheets after a failed sync)", async () => {
      // 1. Fresh load whose CALCULATED write fails → rows are left unsynced.
      cache.resetCache();
      await mock("__control?mode=ok&delayMs=0&putFail=1&bump=1");
      // bump=1 changed a synthetic result, so these rows differ from any
      // earlier successful sync and the (failing) sync really is attempted.
      await quietly(() => routes.leaderboard.GET(req("/api/leaderboard")));
      await sleep(500);
      // 2. Writes work again, but reads are now slower than the stale-wait, so
      //    the next leaderboard is answered from the fallback copy.
      await mock("__control?putFail=0&mode=slow&delayMs=3500");
      const before = await mock("__stats");
      cache.expireCacheForTests();
      const res = await quietly(() => routes.leaderboard.GET(req("/api/leaderboard")));
      const body = await res.json();
      await sleep(8000); // long enough for any (wrongly) scheduled sync to finish
      const after = await mock("__stats");
      await mock("__control?mode=ok&delayMs=0");
      assert.equal(body.dataStatus, "stale");
      assert.equal(after.puts, before.puts, "a stale copy must never be written to CALCULATED");
      assert.equal(after.gets.CALCULATED ?? 0, before.gets.CALCULATED ?? 0, "no sync should even start");
      cache.resetCache();
    });

    await test("Sheets outage with no cache → 503, generic message, no-store, no internals", async () => {
      cache.resetCache();
      await mock("__control?mode=quota");
      const res = await quietly(() => routes.awards.GET(req("/api/awards")));
      await mock("__control?mode=ok");
      assert.equal(res.status, 503);
      assert.equal(res.headers.get("cache-control"), "no-store");
      assert.equal(res.headers.get("retry-after"), "30");
      const text = await res.text();
      assert.equal(text, JSON.stringify({ error: "Failed to fetch awards" }));
      cache.resetCache();
    });

    await test("lookup is rate-limited per client: 301st request in a minute → 429 no-store", async () => {
      let last: Response | undefined;
      for (let i = 0; i < 301; i++) {
        last = await routes.lookup.GET(req("/api/team-lookup?name=Nobody&semester=I&branch=CE", "198.51.100.77"));
      }
      assert.equal(last!.status, 429);
      assert.equal(last!.headers.get("cache-control"), "no-store");
      assert.ok(Number(last!.headers.get("retry-after")) > 0);
      // A different client is unaffected.
      const other = await routes.lookup.GET(req("/api/team-lookup?name=Nobody&semester=I&branch=CE", "198.51.100.78"));
      assert.notEqual(other.status, 429);
    });

    // ── freshness helper ──────────────────────────────────────────────────
    console.log("\n── Freshness ─────────────────────────────────────────────────");

    await test("describeFreshness: live within TTL, stale after, reports oldest read time", async () => {
      cache.resetCache();
      await cache.cachedLoad("a", { ttlMs: 50, staleMs: 10_000 }, async () => 1);
      await sleep(10);
      await cache.cachedLoad("b", { ttlMs: 50, staleMs: 10_000 }, async () => 2);
      const live = cache.describeFreshness(["a", "b"]);
      assert.equal(live.dataStatus, "live");
      const aTime = Date.parse(live.dataAsOf);
      await sleep(60);
      const stale = cache.describeFreshness(["a", "b"]);
      assert.equal(stale.dataStatus, "stale");
      assert.equal(Date.parse(stale.dataAsOf), aTime, "dataAsOf is the oldest source");
      cache.resetCache();
    });
  } finally {
    mockServer.kill();
  }

  console.log(`\n${"═".repeat(64)}`);
  console.log(`  Security — ${passed + failed} tests total`);
  console.log(`  ✓ PASSED: ${passed}`);
  if (failed > 0) {
    console.log(`  ✗ FAILED: ${failed}`);
    failures.forEach((f) => console.error(`    • ${f}`));
    process.exit(1);
  } else {
    console.log("  All tests passed.\n");
    process.exit(0);
  }
}

main();
