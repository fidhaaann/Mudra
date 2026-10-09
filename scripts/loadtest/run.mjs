// MUDRA load / failure test driver. Run ONLY against a local or staging
// build wired to scripts/loadtest/mock-sheets.mjs — never against production,
// Tally or the real Google Sheets.
//
//   node scripts/loadtest/run.mjs load    --base http://127.0.0.1:3200 --stages 50,100,250,500,800 --stageSec 40
//   node scripts/loadtest/run.mjs load    --sharedIp          (everyone behind one campus IP)
//   node scripts/loadtest/run.mjs burst   --n 500             (simultaneous cold-cache requests)
//   node scripts/loadtest/run.mjs failure --vus 200           (Sheets outage / quota / slow mid-test)
//
// Options: --base URL (app), --mock URL (mock sheets), --pid N (server PID for CPU/memory)

import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const cmd = args[0] ?? "load";
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : i >= 0 ? true : def;
};
const BASE = opt("base", "http://127.0.0.1:3200");
const MOCK = opt("mock", "http://127.0.0.1:4010");
const PID = opt("pid", null);
const TIMEOUT_MS = 15_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (weighted) => {
  let r = Math.random() * weighted.reduce((s, [w]) => s + w, 0);
  for (const [w, v] of weighted) if ((r -= w) <= 0) return v;
  return weighted[0][1];
};

// ─── traffic model ───────────────────────────────────────────────────────────
// One "journey" = a page view: the HTML document, then the API calls that page
// makes on load (in parallel, as the browser does). Static JS/CSS/images are
// excluded: in production they come from the CDN, not the app server.

const BRANCHES = ["CSE", "ECE", "ME", "CE", "EEE"];
const eventId = () => `E${String(1 + Math.floor(Math.random() * 39)).padStart(3, "0")}`;
function lookupQuery() {
  const i = 1 + Math.floor(Math.random() * 3000);
  const q = new URLSearchParams({
    name: `TEST STUDENT ${String(i).padStart(4, "0")}`,
    semester: `S${1 + (i % 8)}`,
    branch: BRANCHES[i % 5],
  });
  return `/api/team-lookup?${q}`;
}

const JOURNEYS = [
  [40, () => [["page", "/"], ["api", "/api/leaderboard"], ["api", "/api/awards"]]],
  [15, () => [["page", "/events"], ["api", "/api/events"]]],
  [10, () => { const id = eventId(); return [["page", `/events/${id}`], ["api", `/api/events/${id}`], ["api", `/api/events/${id}/results`]]; }],
  [15, () => [["page", "/leaderboard"], ["api", "/api/leaderboard"], ["api", "/api/awards"]]],
  [10, () => [["page", "/schedule"], ["api", "/api/schedule"]]],
  [10, () => [["page", "/lookup"], ["api", lookupQuery()]]],
];

// ─── measurement ─────────────────────────────────────────────────────────────

function newMetrics() {
  return { samples: [], byStatus: {}, errors: {}, byRoute: {} };
}

async function request(m, kind, path, ip) {
  const route = kind === "page" ? "page" : path.replace(/E\d{3}/, ":id").replace(/\?.*$/, "");
  const t0 = performance.now();
  let status = "ERR";
  try {
    const res = await fetch(BASE + path, {
      headers: { "x-forwarded-for": ip, accept: kind === "page" ? "text/html" : "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    await res.arrayBuffer();
    status = res.status;
  } catch (e) {
    const name = e?.name === "TimeoutError" ? "timeout" : (e?.cause?.code ?? e?.name ?? "error");
    m.errors[name] = (m.errors[name] ?? 0) + 1;
  }
  const ms = performance.now() - t0;
  m.samples.push(ms);
  m.byStatus[status] = (m.byStatus[status] ?? 0) + 1;
  const r = (m.byRoute[route] ??= { n: 0, ms: [], bad: 0 });
  r.n++; r.ms.push(ms);
  if (status === "ERR" || status >= 500) r.bad++;
}

const pct = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const fmt = (n) => `${Math.round(n)}ms`;

async function mockStats() {
  try { return await (await fetch(`${MOCK}/__stats`)).json(); } catch { return null; }
}
async function mockControl(q) { await fetch(`${MOCK}/__control?${q}`); }

function procSample() {
  if (!PID) return null;
  try {
    const out = execSync(
      `powershell -NoProfile -Command "$p=Get-Process -Id ${PID}; '{0} {1}' -f $p.TotalProcessorTime.TotalSeconds,$p.WorkingSet64"`,
      { encoding: "utf8" }
    ).trim().split(" ");
    return { cpu: Number(out[0]), mem: Number(out[1]) };
  } catch { return null; }
}

// ─── virtual users ───────────────────────────────────────────────────────────

async function runStage({ vus, seconds, sharedIp, label, during }) {
  const m = newMetrics();
  const before = await mockStats();
  const p0 = procSample();
  const end = Date.now() + seconds * 1000;
  const started = Date.now();
  let apiRequests = 0;

  const vu = async (i) => {
    const ip = sharedIp ? "198.51.100.10" : `10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`;
    await sleep(rand(0, 5000)); // staggered arrival over the first 5 s
    while (Date.now() < end) {
      const steps = pick(JOURNEYS)();
      const [first, ...rest] = steps;
      await request(m, first[0], first[1], ip);
      apiRequests += rest.length;
      await Promise.all(rest.map(([k, p]) => request(m, k, p, ip)));
      await sleep(rand(2000, 6000)); // reading the page
    }
  };

  const work = Promise.all(Array.from({ length: vus }, (_, i) => vu(i + 1)));
  if (during) await during(started);
  await work;

  const elapsed = (Date.now() - started) / 1000;
  const after = await mockStats();
  const p1 = procSample();
  const gets = after && before
    ? Object.values(after.gets).reduce((a, b) => a + b, 0) - Object.values(before.gets).reduce((a, b) => a + b, 0)
    : null;
  const total = m.samples.length;
  const bad5xx = Object.entries(m.byStatus).filter(([s]) => s !== "ERR" && Number(s) >= 500).reduce((a, [, n]) => a + n, 0);
  const n4xx = Object.entries(m.byStatus).filter(([s]) => Number(s) >= 400 && Number(s) < 500).reduce((a, [, n]) => a + n, 0);
  const errs = Object.values(m.errors).reduce((a, b) => a + b, 0);

  const summary = {
    label, vus, seconds: Math.round(elapsed), requests: total, rps: +(total / elapsed).toFixed(1),
    p50: fmt(pct(m.samples, 50)), p95: fmt(pct(m.samples, 95)), p99: fmt(pct(m.samples, 99)),
    status: m.byStatus, pct4xx: +((n4xx / total) * 100).toFixed(2), pct5xx: +((bad5xx / total) * 100).toFixed(2),
    netErrors: m.errors, errRate: +((errs / total) * 100).toFixed(2),
    apiRequests, sheetsReads: gets, sheetsWrites: after && before ? after.puts - before.puts : null,
    cacheHitRatio: gets !== null && apiRequests ? +(1 - gets / apiRequests).toFixed(4) : null,
    cpuCoresAvg: p0 && p1 ? +((p1.cpu - p0.cpu) / elapsed).toFixed(2) : null,
    memMB: p1 ? Math.round(p1.mem / 1048576) : null,
    routes: Object.fromEntries(Object.entries(m.byRoute).map(([r, v]) => [r, `n=${v.n} p95=${fmt(pct(v.ms, 95))} 5xx/err=${v.bad}`])),
  };
  console.log(JSON.stringify(summary, null, 1));
  return summary;
}

// ─── commands ────────────────────────────────────────────────────────────────

if (cmd === "load") {
  const stages = String(opt("stages", "50,100,250,500,800")).split(",").map(Number);
  const seconds = Number(opt("stageSec", 40));
  const sharedIp = opt("sharedIp", false) === true;
  await mockControl("mode=ok");
  for (const vus of stages) {
    await runStage({ vus, seconds, sharedIp, label: `${vus} users${sharedIp ? " (one shared IP)" : ""}` });
    await sleep(3000);
  }
} else if (cmd === "burst") {
  // Simultaneous identical requests right as the server's caches are cold.
  const n = Number(opt("n", 500));
  await mockControl("mode=ok&delayMs=300"); // a realistic Sheets round-trip
  await fetch(`${MOCK}/__reset`);
  const m = newMetrics();
  const paths = ["/api/leaderboard", "/api/awards", "/api/schedule", "/api/events"];
  const t0 = performance.now();
  await Promise.all(Array.from({ length: n }, (_, i) => request(m, "api", paths[i % paths.length], `10.9.${i >> 8}.${i & 255}`)));
  const wall = performance.now() - t0;
  const s = await mockStats();
  await mockControl("mode=ok&delayMs=0");
  console.log(JSON.stringify({
    label: `burst: ${n} simultaneous API requests on a cold cache`, wallMs: Math.round(wall),
    status: m.byStatus, p50: fmt(pct(m.samples, 50)), p99: fmt(pct(m.samples, 99)),
    sheetsReadsByTab: s?.gets, totalSheetsCalls: s?.total,
  }, null, 1));
} else if (cmd === "failure") {
  // Warm the caches, then break Sheets mid-test and watch what users get.
  const vus = Number(opt("vus", 200));
  const failMode = String(opt("mode", "fail"));
  await mockControl("mode=ok&delayMs=0");
  await runStage({
    vus, seconds: 75, sharedIp: false, label: `${vus} users; Sheets "${failMode}" from t=15s to t=60s`,
    during: async (started) => {
      await sleep(15_000 - (Date.now() - started));
      await fetch(`${MOCK}/__reset`);
      await mockControl(`mode=${failMode}`);
      console.error(`[t=15s] Sheets switched to ${failMode}`);
      await sleep(45_000);
      const s = await mockStats();
      console.error(`[t=60s] Sheets calls during outage: ${s.total} (failed: ${s.failures}); restoring`);
      await mockControl("mode=ok&delayMs=0");
    },
  });
} else {
  console.error(`unknown command ${cmd}`);
  process.exit(1);
}
