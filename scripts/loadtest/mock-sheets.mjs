// Mock Google Sheets API (values.get / values.update) for load and failure
// testing. NEVER contacts Google. All data is synthetic test data.
//
// Usage:  node scripts/loadtest/mock-sheets.mjs [port=4010]
// Point the app at it with:  SHEETS_API_MOCK_ROOT=http://127.0.0.1:4010/
//
// Control endpoints (for the load script):
//   GET /__control?mode=ok|fail|quota|slow&delayMs=1500   change behaviour
//   GET /__control?putFail=1                               make writes fail (reads unaffected)
//   GET /__control?bump=1                                  change one synthetic result (new standings)
//   GET /__stats                                           call counters
//   GET /__reset                                           zero the counters

import http from "node:http";

const port = Number(process.argv[2] ?? 4010);

// ─── synthetic fixtures ──────────────────────────────────────────────────────

const TEAMS = ["RAAGA", "AGNI", "TARANG", "UTSAV", "MBA"];
const CATS = [
  ["ON-STAGE", "SOLO", "SOLO"],
  ["ON-STAGE", "DUO", "DUO"],
  ["ON-STAGE", "GROUP", "GROUP"],
  ["OFF-STAGE", "SOLO", "OFF-STAGE"],
];

const EVENTS = [["EVENT_ID", "NAME", "CATEGORY", "PARTICIPANT_TYPE", "POINTS_CATEGORY", "DESCRIPTION",
  "IMAGE_URL", "REGISTRATION_LINK", "DATE", "START_TIME", "END_TIME", "VENUE", "STATUS", "DISPLAY_ORDER"]];
const RESULTS = [["RESULT_ID", "EVENT_ID", "EVENT_NAME", "POSITION", "ENTRY_NAME", "TEAM", "POINTS"]];
for (let i = 1; i <= 39; i++) {
  const id = `E${String(i).padStart(3, "0")}`;
  const [category, ptype, pcat] = CATS[i % CATS.length];
  const completed = i <= 12;
  EVENTS.push([id, `TEST EVENT ${i}`, category, ptype, pcat, "Synthetic event for load testing.", "",
    i % 3 === 0 ? "" : `https://tally.so/r/test${i}`, "2026-10-20", `${9 + (i % 8)}:00 AM`, "",
    `Hall ${1 + (i % 4)}`, completed ? "COMPLETED" : "UPCOMING", String(i)]);
  for (let pos = 1; pos <= 3; pos++) {
    RESULTS.push([`R${i}-${pos}`, id, `TEST EVENT ${i}`, String(pos),
      completed ? `Entry ${pos}` : "", completed ? TEAMS[(i + pos) % TEAMS.length] : "", "999"]);
  }
}

const SHEETS = {
  EVENTS,
  RESULTS,
  MANUAL: [["TEAM", "TOTAL_POINTS", "NOTE", "LAST_UPDATED"], ...TEAMS.map((t) => [t])],
  CALCULATED: [["TEAM", "TOTAL_POINTS", "1ST", "2ND", "3RD"],
    ...TEAMS.map((t) => [t === "UTSAV" ? "UTSUV" : t, "0", "0", "0", "0"])],
  AWARDS: [["KALATHILAKAM", "KALAPRATHIBHA"], ["", ""]],
  STUDENTS: [["STUDENT_ID", "NAME", "SEMESTER", "BRANCH", "TEAM"]],
};
// 3,000 synthetic students across the four houses (no MBA students exist).
const BRANCHES = ["CSE", "ECE", "ME", "CE", "EEE"];
for (let i = 1; i <= 3000; i++) {
  SHEETS.STUDENTS.push([`T${i}`, `TEST STUDENT ${String(i).padStart(4, "0")}`, `S${1 + (i % 8)}`,
    BRANCHES[i % BRANCHES.length], TEAMS[i % 4]]);
}

// ─── behaviour + counters ────────────────────────────────────────────────────

let mode = "ok";
let delayMs = 0;
let putFail = false;
let stats = { gets: {}, puts: 0, failures: 0, total: 0 };

const colIndex = (letters) => [...letters].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

/** Apply an A1 range like "A2:E6", "A:D" or "A1:B2" to a sheet's rows. */
function slice(rows, a1) {
  if (!a1) return rows;
  const m = a1.match(/^([A-Z]+)(\d*):([A-Z]+)(\d*)$/);
  if (!m) return rows;
  const [, c1, r1, c2, r2] = m;
  const top = r1 ? Number(r1) - 1 : 0;
  const bottom = r2 ? Number(r2) : rows.length;
  return rows.slice(top, bottom).map((row) => row.slice(colIndex(c1), colIndex(c2) + 1));
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);

  if (url.pathname === "/__control") {
    if (url.searchParams.has("putFail")) putFail = url.searchParams.get("putFail") === "1";
    if (url.searchParams.get("bump") === "1") {
      // Rotate the 1st-place team of the first completed event.
      const row = SHEETS.RESULTS[1];
      row[5] = TEAMS[(TEAMS.indexOf(row[5]) + 1) % TEAMS.length];
    }
    if (url.searchParams.has("mode") || url.searchParams.has("delayMs")) {
      mode = url.searchParams.get("mode") ?? mode;
      delayMs = Number(url.searchParams.get("delayMs") ?? (mode === "slow" ? 1500 : 0));
    }
    return send(res, 200, { mode, delayMs, putFail });
  }
  if (url.pathname === "/__stats") return send(res, 200, { mode, delayMs, ...stats });
  if (url.pathname === "/__reset") {
    stats = { gets: {}, puts: 0, failures: 0, total: 0 };
    return send(res, 200, { ok: true });
  }

  const m = url.pathname.match(/^\/v4\/spreadsheets\/([^/]+)\/values\/(.+)$/);
  if (!m) return send(res, 404, { error: { code: 404, message: "not found" } });
  const range = decodeURIComponent(m[2]);
  const [sheet, a1] = range.split("!");
  stats.total++;

  if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  if (mode === "fail") {
    stats.failures++;
    return send(res, 503, { error: { code: 503, message: "The service is currently unavailable.", status: "UNAVAILABLE" } });
  }
  if (mode === "quota") {
    stats.failures++;
    return send(res, 429, { error: { code: 429, message: "Quota exceeded for quota metric 'Read requests'.", status: "RESOURCE_EXHAUSTED" } });
  }

  const rows = SHEETS[sheet];
  if (!rows) return send(res, 400, { error: { code: 400, message: `Unable to parse range: ${range}` } });

  if (req.method === "PUT") {
    if (putFail) {
      stats.failures++;
      return send(res, 503, { error: { code: 503, message: "Write failed (simulated).", status: "UNAVAILABLE" } });
    }
    let body = "";
    for await (const chunk of req) body += chunk;
    stats.puts++;
    const values = JSON.parse(body || "{}").values ?? [];
    const top = Number(a1.match(/\d+/)?.[0] ?? 1) - 1;
    values.forEach((row, i) => { rows[top + i] = row; });
    return send(res, 200, { updatedRange: range, updatedRows: values.length });
  }

  stats.gets[sheet] = (stats.gets[sheet] ?? 0) + 1;
  return send(res, 200, { range, majorDimension: "ROWS", values: slice(rows, a1) });
});

server.listen(port, "127.0.0.1", () => console.log(`mock sheets on http://127.0.0.1:${port}/`));
