/**
 * MUDRA 2026 — Competition Logic Audit
 * =====================================
 * Self-contained test file using Node's built-in assert module.
 * Run with:  npx tsx __tests__/competition-logic.test.ts
 *
 * IMPORTANT: No Google Sheets calls are made. All tests operate on
 * in-process fixture data only. Nothing is written to any spreadsheet.
 *
 * Coverage:
 *  - POINT_RULES table values
 *  - getPointsForRank for all four categories
 *  - officialPoints() helper
 *  - Painting Relay (group participantType, offstage pointsCategory → 8/5/3)
 *  - buildLeaderboard() logic (scoring + ranking) via an inline test double
 *  - Standard competition ranking (tied totals share rank, no tie-breaker)
 *  - Multiple events for same team
 *  - Zero completed events
 *  - Invalid/malformed placement positions (0, 4, NaN, negative)
 *  - Malformed/blank result rows
 *  - Duplicate placements for same event (last-one-wins de-dup handled by Map)
 *  - schedule projectEvent() parsing
 *  - calculateTeamStandings() ranking divergence fix
 *  - MBA as the fifth team: parsing, scoring, MANUAL overrides, ties,
 *    five-row CALCULATED sync, RESULTS row → team mapping, house lookup
 */

import assert from "node:assert/strict";
import { POINT_RULES, getPointsForRank } from "../data/pointRules";
import { officialPoints, calculateTeamStandings } from "../lib/scoring";
import { buildPublishedEventResult, parseResultRows } from "../lib/server/google/competition";
import { EVENTS } from "../data/events";
import { TEAMS, parseTeamId } from "../data/teams";
import { TEAM_IDS } from "../types/team";
import type { TeamId } from "../types/team";
import { resolveHouse } from "../lib/houses";
import {
  calculateCalculatedLeaderboard,
  calculateEffectiveLeaderboard,
  calculatedRowsToSheetValues,
  synchronizeCalculatedRows,
  CALCULATED_WRITE_RANGE,
} from "../lib/server/google/leaderboard";
import type { CalculatedLeaderboardRow, ManualLeaderboardRow } from "../types/leaderboard";
import type { Event as CompetitionEvent } from "../types/event";
import type { EventResult as CompetitionEventResult } from "../types/result";

// ─── tiny helpers ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

// Async tests are collected and awaited before the summary, so a failing
// assertion inside an async test is counted instead of escaping as an
// unhandled rejection.
const pending: Promise<void>[] = [];

function pass(name: string) {
  console.log(`  ✓  ${name}`);
  passed++;
}

function fail(name: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`  ✗  ${name}\n     ${msg}`);
  failed++;
  failures.push(`${name}: ${msg}`);
}

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const outcome = fn();
    if (outcome instanceof Promise) {
      pending.push(outcome.then(() => pass(name), (err) => fail(name, err)));
      return;
    }
    pass(name);
  } catch (err) {
    fail(name, err);
  }
}

function section(title: string) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 60 - title.length))}`);
}

// ─── inline types (mirrors production types, no import needed) ────────────────

type PointsCategory = "group" | "duo" | "solo" | "offstage";

interface PodiumPlacement {
  placement: 1 | 2 | 3;
  participantOrTeamName: string;
  teamId: TeamId;
  pointsAwarded: number; // ignored by official scoring
}

interface EventResult {
  eventId: string;
  placements: PodiumPlacement[];
  isDemoData: boolean;
}

interface EventMeta {
  id: string;
  pointsCategory: PointsCategory;
  status: "upcoming" | "live" | "completed";
}

/** Inline re-implementation of buildLeaderboard scoring logic for isolated testing */
function scoreLeaderboard(
  events: EventMeta[],
  results: EventResult[]
): Record<TeamId, number> {
  const SCORING: Record<PointsCategory, Record<1 | 2 | 3, number>> = {
    group:    { 1: 20, 2: 15, 3: 10 },
    duo:      { 1: 12, 2:  8, 3:  5 },
    solo:     { 1: 10, 2:  7, 3:  5 },
    offstage: { 1:  8, 2:  5, 3:  3 },
  };
  const totals = Object.fromEntries(TEAM_IDS.map((id) => [id, 0])) as Record<TeamId, number>;
  const eventMap = new Map(events.map(e => [e.id.toLowerCase(), e]));

  for (const result of results) {
    const event = eventMap.get(result.eventId.toLowerCase());
    if (!event || event.status !== "completed") continue;
    for (const p of result.placements) {
      const pos = p.placement;
      if (pos !== 1 && pos !== 2 && pos !== 3) continue;
      const pts = SCORING[event.pointsCategory]?.[pos];
      if (pts === undefined) continue;
      totals[p.teamId] = (totals[p.teamId] ?? 0) + pts;
    }
  }
  return totals;
}

/** Inline re-implementation of standard competition ranking */
function rank(scores: Record<TeamId, number>): Record<TeamId, number> {
  const sorted = (Object.entries(scores) as [TeamId, number][])
    .sort((a, b) => b[1] - a[1]);
  const ranks: Record<TeamId, number> = {} as Record<TeamId, number>;
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0 || sorted[i][1] !== sorted[i - 1][1]) {
      ranks[sorted[i][0]] = i + 1;
    } else {
      ranks[sorted[i][0]] = ranks[sorted[i - 1][0]];
    }
  }
  return ranks;
}

// ─── SECTION 1: POINT_RULES table values ─────────────────────────────────────

section("1. POINT_RULES table");

test("group  1st = 20", () => assert.equal(POINT_RULES.group.first,    20));
test("group  2nd = 15", () => assert.equal(POINT_RULES.group.second,   15));
test("group  3rd = 10", () => assert.equal(POINT_RULES.group.third,    10));
test("duo    1st = 12", () => assert.equal(POINT_RULES.duo.first,      12));
test("duo    2nd =  8", () => assert.equal(POINT_RULES.duo.second,      8));
test("duo    3rd =  5", () => assert.equal(POINT_RULES.duo.third,       5));
test("solo   1st = 10", () => assert.equal(POINT_RULES.solo.first,     10));
test("solo   2nd =  7", () => assert.equal(POINT_RULES.solo.second,     7));
test("solo   3rd =  5", () => assert.equal(POINT_RULES.solo.third,      5));
test("offstage 1st = 8",() => assert.equal(POINT_RULES.offstage.first,  8));
test("offstage 2nd = 5",() => assert.equal(POINT_RULES.offstage.second, 5));
test("offstage 3rd = 3",() => assert.equal(POINT_RULES.offstage.third,  3));

// ─── SECTION 2: getPointsForRank ─────────────────────────────────────────────

section("2. getPointsForRank()");

test("group  rank 1 → 20", () => assert.equal(getPointsForRank("group",    1), 20));
test("group  rank 2 → 15", () => assert.equal(getPointsForRank("group",    2), 15));
test("group  rank 3 → 10", () => assert.equal(getPointsForRank("group",    3), 10));
test("duo    rank 1 → 12", () => assert.equal(getPointsForRank("duo",      1), 12));
test("duo    rank 2 →  8", () => assert.equal(getPointsForRank("duo",      2),  8));
test("duo    rank 3 →  5", () => assert.equal(getPointsForRank("duo",      3),  5));
test("solo   rank 1 → 10", () => assert.equal(getPointsForRank("solo",     1), 10));
test("solo   rank 2 →  7", () => assert.equal(getPointsForRank("solo",     2),  7));
test("solo   rank 3 →  5", () => assert.equal(getPointsForRank("solo",     3),  5));
test("offstage rank 1 → 8",() => assert.equal(getPointsForRank("offstage", 1),  8));
test("offstage rank 2 → 5",() => assert.equal(getPointsForRank("offstage", 2),  5));
test("offstage rank 3 → 3",() => assert.equal(getPointsForRank("offstage", 3),  3));

// ─── SECTION 3: officialPoints() ─────────────────────────────────────────────

section("3. officialPoints() — never trusts pointsAwarded");

test("officialPoints('group', 1) = 20",    () => assert.equal(officialPoints("group",    1), 20));
test("officialPoints('offstage', 3) = 3",  () => assert.equal(officialPoints("offstage", 3),  3));
// Even if sheet stored a wrong value, official function ignores it
test("officialPoints ignores sheet value", () => {
  // sheet might store 999, but official function doesn't accept that param
  assert.equal(officialPoints("solo", 1), 10);
});

test("event result scoring ignores volunteer POINTS values", () => {
  const volunteerPoints = 999;
  const officialPointsForPlacement = getPointsForRank("solo", 1);
  assert.notEqual(officialPointsForPlacement, volunteerPoints);
  assert.equal(officialPointsForPlacement, 10);
});

test("published finished results calculate all placement points and ignore sheet POINTS", () => {
  const event: CompetitionEvent = {
    id: "finished-solo",
    name: "Finished Solo",
    category: "on-stage",
    participantType: "solo",
    pointsCategory: "solo",
    status: "completed",
  };
  const result = buildPublishedEventResult(event, [
    { placement: 1, participantOrTeamName: "Winner", teamId: "raaga", pointsAwarded: 999 },
    { placement: 2, participantOrTeamName: "Runner-up", teamId: "agni", pointsAwarded: 999 },
    { placement: 3, participantOrTeamName: "Third", teamId: "tarang", pointsAwarded: 999 },
  ]);
  assert.deepEqual(result?.placements.map((placement) => placement.pointsAwarded), [10, 7, 5]);
});

test("upcoming and live events publish no completed results", () => {
  const placements: PodiumPlacement[] = [
    { placement: 1, participantOrTeamName: "Winner", teamId: "raaga", pointsAwarded: 999 },
  ];
  const baseEvent: CompetitionEvent = {
    id: "event",
    name: "Event",
    category: "on-stage",
    participantType: "solo",
    pointsCategory: "solo",
    status: "upcoming",
  };
  assert.equal(buildPublishedEventResult(baseEvent, placements), null);
  assert.equal(
    buildPublishedEventResult({ ...baseEvent, status: "live" }, placements),
    null
  );
});

// ─── SECTION 4: Painting Relay ───────────────────────────────────────────────

section("4. Painting Relay — group participantType, offstage pointsCategory → 8/5/3");

test("painting-relay exists in EVENTS", () => {
  const pr = EVENTS.find(e => e.id === "painting-relay");
  assert.ok(pr, "painting-relay not found in EVENTS");
});

test("painting-relay participantType = 'group'", () => {
  const pr = EVENTS.find(e => e.id === "painting-relay")!;
  assert.equal(pr.participantType, "group");
});

test("painting-relay pointsCategory = 'offstage'", () => {
  const pr = EVENTS.find(e => e.id === "painting-relay")!;
  assert.equal(pr.pointsCategory, "offstage");
});

test("painting-relay category = 'off-stage'", () => {
  const pr = EVENTS.find(e => e.id === "painting-relay")!;
  assert.equal(pr.category, "off-stage");
});

test("painting-relay 1st place → 8 pts (offstage scoring, NOT group)", () => {
  const pr = EVENTS.find(e => e.id === "painting-relay")!;
  assert.equal(getPointsForRank(pr.pointsCategory, 1), 8,
    "Painting Relay 1st should be 8 (offstage), not 20 (group)");
});

test("painting-relay 2nd place → 5 pts", () => {
  const pr = EVENTS.find(e => e.id === "painting-relay")!;
  assert.equal(getPointsForRank(pr.pointsCategory, 2), 5);
});

test("painting-relay 3rd place → 3 pts", () => {
  const pr = EVENTS.find(e => e.id === "painting-relay")!;
  assert.equal(getPointsForRank(pr.pointsCategory, 3), 3);
});

// ─── SECTION 5: EVENTS dataset ───────────────────────────────────────────────

section("5. EVENTS dataset integrity");

test("exactly 39 events", () => assert.equal(EVENTS.length, 39));

test("22 on-stage events", () => {
  assert.equal(EVENTS.filter(e => e.category === "on-stage").length, 22);
});

test("17 off-stage events", () => {
  assert.equal(EVENTS.filter(e => e.category === "off-stage").length, 17);
});

test("all events have non-empty id", () => {
  const bad = EVENTS.filter(e => !e.id || e.id.trim() === "");
  assert.equal(bad.length, 0, `Events with empty id: ${bad.map(e => e.name).join(", ")}`);
});

test("all event ids are unique", () => {
  const ids = EVENTS.map(e => e.id);
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length, "Duplicate event IDs found");
});

test("all events have valid pointsCategory", () => {
  const valid = new Set(["group", "duo", "solo", "offstage"]);
  const bad = EVENTS.filter(e => !valid.has(e.pointsCategory));
  assert.equal(bad.length, 0, `Invalid pointsCategory: ${bad.map(e => e.id).join(", ")}`);
});

test("5 teams defined", () => assert.equal(TEAMS.length, 5));

test("team ids are raaga/agni/tarang/utsav/mba in canonical order", () => {
  assert.deepEqual(TEAMS.map(t => t.id), ["raaga", "agni", "tarang", "utsav", "mba"]);
  assert.deepEqual(TEAMS.map(t => t.name), ["RAAGA", "AGNI", "TARANG", "UTSAV", "MBA"]);
});

// ─── SECTION 6: Leaderboard scoring — single events ──────────────────────────

section("6. Leaderboard scoring — single events");

test("group event: raaga 1st → 20 pts", () => {
  const evs: EventMeta[] = [{ id: "group-dance", pointsCategory: "group", status: "completed" }];
  const res: EventResult[] = [{
    eventId: "group-dance",
    placements: [{ placement: 1, participantOrTeamName: "Raaga Team", teamId: "raaga", pointsAwarded: 999 }],
    isDemoData: false,
  }];
  const totals = scoreLeaderboard(evs, res);
  assert.equal(totals.raaga, 20, `Expected 20, got ${totals.raaga}`);
  assert.equal(totals.agni,  0);
});

test("duo event: agni 2nd → 8 pts", () => {
  const evs: EventMeta[] = [{ id: "duo-dance", pointsCategory: "duo", status: "completed" }];
  const res: EventResult[] = [{
    eventId: "duo-dance",
    placements: [{ placement: 2, participantOrTeamName: "Agni Duo", teamId: "agni", pointsAwarded: 0 }],
    isDemoData: false,
  }];
  const totals = scoreLeaderboard(evs, res);
  assert.equal(totals.agni, 8);
});

test("solo event: tarang 3rd → 5 pts", () => {
  const evs: EventMeta[] = [{ id: "bharathanaatyam", pointsCategory: "solo", status: "completed" }];
  const res: EventResult[] = [{
    eventId: "bharathanaatyam",
    placements: [{ placement: 3, participantOrTeamName: "Tarang Solo", teamId: "tarang", pointsAwarded: 0 }],
    isDemoData: false,
  }];
  const totals = scoreLeaderboard(evs, res);
  assert.equal(totals.tarang, 5);
});

test("offstage event: utsav 1st → 8 pts", () => {
  const evs: EventMeta[] = [{ id: "pencil-drawing", pointsCategory: "offstage", status: "completed" }];
  const res: EventResult[] = [{
    eventId: "pencil-drawing",
    placements: [{ placement: 1, participantOrTeamName: "Utsav Artist", teamId: "utsav", pointsAwarded: 999 }],
    isDemoData: false,
  }];
  const totals = scoreLeaderboard(evs, res);
  assert.equal(totals.utsav, 8,
    `Expected 8 (offstage scoring), got ${totals.utsav}. Sheet pointsAwarded=999 must be ignored.`);
});

test("painting-relay 1st → 8 pts (NOT 20)", () => {
  const evs: EventMeta[] = [{ id: "painting-relay", pointsCategory: "offstage", status: "completed" }];
  const res: EventResult[] = [{
    eventId: "painting-relay",
    placements: [{ placement: 1, participantOrTeamName: "Raaga Relay", teamId: "raaga", pointsAwarded: 20 }],
    isDemoData: false,
  }];
  const totals = scoreLeaderboard(evs, res);
  assert.equal(totals.raaga, 8,
    `Painting Relay must score 8 (offstage), not 20 (group). Got ${totals.raaga}`);
});

// ─── SECTION 7: Upcoming events contribute 0 points ──────────────────────────

section("7. Upcoming / live events contribute 0 points");

test("upcoming event not counted", () => {
  const evs: EventMeta[] = [{ id: "group-dance", pointsCategory: "group", status: "upcoming" }];
  const res: EventResult[] = [{
    eventId: "group-dance",
    placements: [{ placement: 1, participantOrTeamName: "Raaga", teamId: "raaga", pointsAwarded: 20 }],
    isDemoData: false,
  }];
  const totals = scoreLeaderboard(evs, res);
  assert.equal(totals.raaga, 0, "Upcoming events must not contribute points");
});

test("live event not counted", () => {
  const evs: EventMeta[] = [{ id: "group-dance", pointsCategory: "group", status: "live" }];
  const res: EventResult[] = [{
    eventId: "group-dance",
    placements: [{ placement: 1, participantOrTeamName: "Agni", teamId: "agni", pointsAwarded: 20 }],
    isDemoData: false,
  }];
  const totals = scoreLeaderboard(evs, res);
  assert.equal(totals.agni, 0, "Live events must not contribute points");
});

// ─── SECTION 8: Multiple events / same team multi-win ────────────────────────

section("8. Multiple events and same-team wins");

test("same team wins two events — points accumulate correctly", () => {
  const evs: EventMeta[] = [
    { id: "group-dance",    pointsCategory: "group",    status: "completed" },
    { id: "solo-dance",     pointsCategory: "solo",     status: "completed" },
  ];
  const res: EventResult[] = [
    {
      eventId: "group-dance",
      placements: [{ placement: 1, participantOrTeamName: "Raaga", teamId: "raaga", pointsAwarded: 0 }],
      isDemoData: false,
    },
    {
      eventId: "solo-dance",
      placements: [{ placement: 1, participantOrTeamName: "Raaga", teamId: "raaga", pointsAwarded: 0 }],
      isDemoData: false,
    },
  ];
  const totals = scoreLeaderboard(evs, res);
  // group 1st (20) + solo 1st (10) = 30
  assert.equal(totals.raaga, 30, `Expected 30, got ${totals.raaga}`);
  assert.equal(totals.agni, 0);
});

test("all four teams score in same event", () => {
  const evs: EventMeta[] = [{ id: "group-dance", pointsCategory: "group", status: "completed" }];
  const res: EventResult[] = [{
    eventId: "group-dance",
    placements: [
      { placement: 1, participantOrTeamName: "R", teamId: "raaga",  pointsAwarded: 0 },
      { placement: 2, participantOrTeamName: "A", teamId: "agni",   pointsAwarded: 0 },
      { placement: 3, participantOrTeamName: "T", teamId: "tarang", pointsAwarded: 0 },
    ],
    isDemoData: false,
  }];
  const totals = scoreLeaderboard(evs, res);
  assert.equal(totals.raaga,  20);
  assert.equal(totals.agni,   15);
  assert.equal(totals.tarang, 10);
  assert.equal(totals.utsav,   0);
});

test("mixed categories across events", () => {
  const evs: EventMeta[] = [
    { id: "ev1", pointsCategory: "group",    status: "completed" }, // raaga 1st → 20
    { id: "ev2", pointsCategory: "duo",      status: "completed" }, // agni 1st → 12
    { id: "ev3", pointsCategory: "solo",     status: "completed" }, // raaga 2nd → 7
    { id: "ev4", pointsCategory: "offstage", status: "completed" }, // agni 3rd → 3
  ];
  const res: EventResult[] = [
    { eventId: "ev1", placements: [{ placement: 1, participantOrTeamName: "", teamId: "raaga", pointsAwarded: 0 }], isDemoData: false },
    { eventId: "ev2", placements: [{ placement: 1, participantOrTeamName: "", teamId: "agni",  pointsAwarded: 0 }], isDemoData: false },
    { eventId: "ev3", placements: [{ placement: 2, participantOrTeamName: "", teamId: "raaga", pointsAwarded: 0 }], isDemoData: false },
    { eventId: "ev4", placements: [{ placement: 3, participantOrTeamName: "", teamId: "agni",  pointsAwarded: 0 }], isDemoData: false },
  ];
  const totals = scoreLeaderboard(evs, res);
  assert.equal(totals.raaga, 27, `raaga: 20+7=27, got ${totals.raaga}`);
  assert.equal(totals.agni,  15, `agni: 12+3=15, got ${totals.agni}`);
});

// ─── SECTION 9: Zero completed events ────────────────────────────────────────

section("9. Zero completed events");

test("no results → all totals = 0", () => {
  const totals = scoreLeaderboard([], []);
  assert.equal(totals.raaga,  0);
  assert.equal(totals.agni,   0);
  assert.equal(totals.tarang, 0);
  assert.equal(totals.utsav,  0);
});

test("results exist but no completed events → all totals = 0", () => {
  const evs: EventMeta[] = [{ id: "group-dance", pointsCategory: "group", status: "upcoming" }];
  const res: EventResult[] = [{
    eventId: "group-dance",
    placements: [{ placement: 1, participantOrTeamName: "", teamId: "raaga", pointsAwarded: 20 }],
    isDemoData: false,
  }];
  const totals = scoreLeaderboard(evs, res);
  assert.equal(totals.raaga, 0);
});

// ─── SECTION 10: Invalid / malformed placements ───────────────────────────────

section("10. Invalid and malformed placements");

test("position 0 is ignored", () => {
  const evs: EventMeta[] = [{ id: "ev1", pointsCategory: "group", status: "completed" }];
  const res: EventResult[] = [{
    eventId: "ev1",
    // TypeScript won't let us use 0 as placement, so we cast via unknown
    placements: [{ placement: 0 as unknown as 1, participantOrTeamName: "", teamId: "raaga", pointsAwarded: 99 }],
    isDemoData: false,
  }];
  const totals = scoreLeaderboard(evs, res);
  assert.equal(totals.raaga, 0, "Position 0 must not award points");
});

test("position 4 is ignored", () => {
  const evs: EventMeta[] = [{ id: "ev1", pointsCategory: "group", status: "completed" }];
  const res: EventResult[] = [{
    eventId: "ev1",
    placements: [{ placement: 4 as unknown as 1, participantOrTeamName: "", teamId: "agni", pointsAwarded: 99 }],
    isDemoData: false,
  }];
  const totals = scoreLeaderboard(evs, res);
  assert.equal(totals.agni, 0, "Position 4 must not award points");
});

test("unknown team id falls back to raaga in parser — but can be tested via unknown", () => {
  // The parser maps unknown teamIds to 'raaga' as a safe default.
  // We verify the scoring system doesn't crash on unexpected teamId values
  // by using a known valid teamId with an unexpected event.
  const evs: EventMeta[] = [{ id: "ev1", pointsCategory: "solo", status: "completed" }];
  const res: EventResult[] = [{
    eventId: "ev1",
    placements: [{ placement: 1, participantOrTeamName: "", teamId: "raaga", pointsAwarded: 0 }],
    isDemoData: false,
  }];
  const totals = scoreLeaderboard(evs, res);
  assert.equal(totals.raaga, 10); // solo 1st = 10
});

test("result for unknown eventId is skipped", () => {
  const evs: EventMeta[] = [{ id: "known-event", pointsCategory: "group", status: "completed" }];
  const res: EventResult[] = [{
    eventId: "unknown-event-xyz",
    placements: [{ placement: 1, participantOrTeamName: "", teamId: "raaga", pointsAwarded: 99 }],
    isDemoData: false,
  }];
  const totals = scoreLeaderboard(evs, res);
  assert.equal(totals.raaga, 0, "Unknown eventId must be skipped");
});

test("empty placements array is safe", () => {
  const evs: EventMeta[] = [{ id: "ev1", pointsCategory: "group", status: "completed" }];
  const res: EventResult[] = [{ eventId: "ev1", placements: [], isDemoData: false }];
  const totals = scoreLeaderboard(evs, res);
  assert.equal(totals.raaga, 0);
});

test("pointsAwarded=999 in sheet is ignored — official score used", () => {
  const evs: EventMeta[] = [{ id: "ev1", pointsCategory: "duo", status: "completed" }];
  const res: EventResult[] = [{
    eventId: "ev1",
    placements: [{ placement: 2, participantOrTeamName: "", teamId: "tarang", pointsAwarded: 999 }],
    isDemoData: false,
  }];
  const totals = scoreLeaderboard(evs, res);
  assert.equal(totals.tarang, 8, `duo 2nd = 8, not 999. Got ${totals.tarang}`);
});

// ─── SECTION 11: Ranking algorithm ───────────────────────────────────────────

section("11. Standard competition ranking — no secondary tie-breaker");

test("50/50/40/30/20 → ranks 1/1/3/4/5", () => {
  const scores: Record<TeamId, number> = { raaga: 50, agni: 50, tarang: 40, utsav: 30, mba: 20 };
  const ranks = rank(scores);
  assert.equal(ranks.raaga,  1, `raaga should be rank 1, got ${ranks.raaga}`);
  assert.equal(ranks.agni,   1, `agni should be rank 1, got ${ranks.agni}`);
  assert.equal(ranks.tarang, 3, `tarang should be rank 3, got ${ranks.tarang}`);
  assert.equal(ranks.utsav,  4, `utsav should be rank 4, got ${ranks.utsav}`);
  assert.equal(ranks.mba,    5, `mba should be rank 5, got ${ranks.mba}`);
});

test("all teams equal → all rank 1", () => {
  const scores: Record<TeamId, number> = { raaga: 20, agni: 20, tarang: 20, utsav: 20, mba: 20 };
  const ranks = rank(scores);
  assert.equal(ranks.raaga,  1);
  assert.equal(ranks.agni,   1);
  assert.equal(ranks.tarang, 1);
  assert.equal(ranks.utsav,  1);
  assert.equal(ranks.mba,    1);
});

test("all different → ranks 1/2/3/4/5", () => {
  const scores: Record<TeamId, number> = { raaga: 40, agni: 30, tarang: 20, utsav: 10, mba: 5 };
  const ranks = rank(scores);
  assert.equal(ranks.raaga,  1);
  assert.equal(ranks.agni,   2);
  assert.equal(ranks.tarang, 3);
  assert.equal(ranks.utsav,  4);
  assert.equal(ranks.mba,    5);
});

test("40/40/40/10/10 → ranks 1/1/1/4/4 (MBA ties UTSAV)", () => {
  const scores: Record<TeamId, number> = { raaga: 40, agni: 40, tarang: 40, utsav: 10, mba: 10 };
  const ranks = rank(scores);
  assert.equal(ranks.raaga,  1);
  assert.equal(ranks.agni,   1);
  assert.equal(ranks.tarang, 1);
  assert.equal(ranks.utsav,  4);
  assert.equal(ranks.mba,    4);
});

test("all zero → ranks 1/1/1/1/1", () => {
  const scores: Record<TeamId, number> = { raaga: 0, agni: 0, tarang: 0, utsav: 0, mba: 0 };
  const ranks = rank(scores);
  // All tied at 0 — all rank 1
  assert.equal(ranks.raaga,  1);
  assert.equal(ranks.agni,   1);
  assert.equal(ranks.tarang, 1);
  assert.equal(ranks.utsav,  1);
  assert.equal(ranks.mba,    1);
});

// ─── SECTION 12: CALCULATED leaderboard rows ─────────────────────────────────

section("12. CALCULATED leaderboard rows");

function calculatedEvent(
  id: string,
  pointsCategory: CompetitionEvent["pointsCategory"],
  status: "completed" | "upcoming" | "live"
): CompetitionEvent {
  return {
    id,
    name: id,
    category: pointsCategory === "offstage" ? "off-stage" : "on-stage",
    participantType: pointsCategory === "group" ? "group" : pointsCategory === "duo" ? "duo" : "solo",
    pointsCategory,
    status,
  };
}

function calculatedResult(
  eventId: string,
  teamId: TeamId,
  placement: 1 | 2 | 3,
  pointsAwarded = 999
): CompetitionEventResult {
  return {
    eventId,
    placements: [{ teamId, placement, participantOrTeamName: teamId, pointsAwarded }],
    isDemoData: false,
  };
}

test("finished group, duo, solo, and off-stage events use official points", () => {
  const rows = calculateCalculatedLeaderboard(
    [
      calculatedEvent("group", "group", "completed"),
      calculatedEvent("duo", "duo", "completed"),
      calculatedEvent("solo", "solo", "completed"),
      calculatedEvent("offstage", "offstage", "completed"),
    ],
    [
      calculatedResult("group", "raaga", 1),
      calculatedResult("duo", "agni", 2),
      calculatedResult("solo", "tarang", 3),
      calculatedResult("offstage", "utsav", 1),
    ]
  );
  assert.deepEqual(
    Object.fromEntries(rows.map((row) => [row.team, row.totalPoints])),
    { raaga: 20, agni: 8, tarang: 5, utsav: 8, mba: 0 }
  );
});

test("upcoming and live events contribute zero", () => {
  const rows = calculateCalculatedLeaderboard(
    [
      calculatedEvent("upcoming", "group", "upcoming"),
      calculatedEvent("live", "solo", "live"),
    ],
    [calculatedResult("upcoming", "raaga", 1), calculatedResult("live", "agni", 1)]
  );
  assert.deepEqual(rows.map((row) => row.totalPoints), [0, 0, 0, 0, 0]);
});

test("multiple finished events accumulate points and placement counts", () => {
  const rows = calculateCalculatedLeaderboard(
    [
      calculatedEvent("one", "group", "completed"),
      calculatedEvent("two", "duo", "completed"),
    ],
    [calculatedResult("one", "raaga", 1), calculatedResult("two", "raaga", 2)]
  );
  const raaga = rows.find((row) => row.team === "raaga")!;
  assert.equal(raaga.totalPoints, 28);
  assert.equal(raaga.firstPlaceCount, 1);
  assert.equal(raaga.secondPlaceCount, 1);
});

test("all five teams (including MBA) are returned with zero rows when unscored", () => {
  const rows = calculateCalculatedLeaderboard([], []);
  assert.deepEqual(rows.map((row) => row.team), ["raaga", "agni", "tarang", "utsav", "mba"]);
  assert.ok(rows.every((row) => row.totalPoints === 0));
});

function manualRow(
  team: TeamId,
  totalPoints: number | string
): ManualLeaderboardRow {
  return {
    team,
    totalPoints: totalPoints as number,
    note: "",
    lastUpdated: "",
  };
}

function calculatedRowsForManualTests(): CalculatedLeaderboardRow[] {
  return [
    { team: "raaga", totalPoints: 100, firstPlaceCount: 2, secondPlaceCount: 1, thirdPlaceCount: 0 },
    { team: "agni", totalPoints: 80, firstPlaceCount: 1, secondPlaceCount: 2, thirdPlaceCount: 1 },
    { team: "tarang", totalPoints: 60, firstPlaceCount: 0, secondPlaceCount: 1, thirdPlaceCount: 2 },
    { team: "utsav", totalPoints: 0, firstPlaceCount: 0, secondPlaceCount: 0, thirdPlaceCount: 0 },
    { team: "mba", totalPoints: 30, firstPlaceCount: 1, secondPlaceCount: 0, thirdPlaceCount: 2 },
  ];
}

test("blank MANUAL row falls back to CALCULATED total", () => {
  const [raaga] = calculateEffectiveLeaderboard(calculatedRowsForManualTests(), []);
  assert.equal(raaga.totalPoints, 100);
  assert.equal(raaga.calculatedPoints, 100);
  assert.equal(raaga.manualTotal, null);
});

test("numeric MANUAL total overrides CALCULATED total", () => {
  const rows = calculateEffectiveLeaderboard(
    calculatedRowsForManualTests(),
    [manualRow("raaga", 25)]
  );
  const raaga = rows.find((row) => row.team === "raaga")!;
  assert.equal(raaga.totalPoints, 25);
  assert.equal(raaga.calculatedPoints, 100);
  assert.equal(raaga.manualTotal, 25);
});

test("MANUAL total of zero is a valid override", () => {
  const rows = calculateEffectiveLeaderboard(
    calculatedRowsForManualTests(),
    [manualRow("raaga", 0)]
  );
  assert.equal(rows.find((row) => row.team === "raaga")!.totalPoints, 0);
});

test("invalid MANUAL text falls back to CALCULATED total", () => {
  const rows = calculateEffectiveLeaderboard(
    calculatedRowsForManualTests(),
    [manualRow("raaga", "not-a-number")]
  );
  const raaga = rows.find((row) => row.team === "raaga")!;
  assert.equal(raaga.totalPoints, 100);
  assert.equal(raaga.manualTotal, null);
});

test("manual override changes rank and point gap using effective totals", () => {
  const rows = calculateEffectiveLeaderboard(
    calculatedRowsForManualTests(),
    [manualRow("tarang", 150)]
  );
  const tarang = rows.find((row) => row.team === "tarang")!;
  const raaga = rows.find((row) => row.team === "raaga")!;
  assert.equal(tarang.rank, 1);
  assert.equal(tarang.pointGap, 0);
  assert.equal(raaga.pointGap, 50);
});

test("equal effective totals share rank without changing placement counts", () => {
  const rows = calculateEffectiveLeaderboard(
    calculatedRowsForManualTests(),
    [manualRow("agni", 100)]
  );
  const raaga = rows.find((row) => row.team === "raaga")!;
  const agni = rows.find((row) => row.team === "agni")!;
  assert.equal(raaga.rank, 1);
  assert.equal(agni.rank, 1);
  assert.equal(agni.firstPlaceCount, 1);
  assert.equal(agni.secondPlaceCount, 2);
  assert.equal(agni.thirdPlaceCount, 1);
});

test("manual merge still returns all five teams", () => {
  const rows = calculateEffectiveLeaderboard(
    calculatedRowsForManualTests(),
    [manualRow("raaga", 0)]
  );
  assert.deepEqual(rows.map((row) => row.team).sort(), ["agni", "mba", "raaga", "tarang", "utsav"]);
});

test("CALCULATED sync writes all five ordered rows and ignores volunteer points", async () => {
  const calculatedRows = [
    { team: "raaga" as TeamId, totalPoints: 20, firstPlaceCount: 1, secondPlaceCount: 0, thirdPlaceCount: 0 },
    { team: "agni" as TeamId, totalPoints: 8, firstPlaceCount: 0, secondPlaceCount: 1, thirdPlaceCount: 0 },
    { team: "tarang" as TeamId, totalPoints: 5, firstPlaceCount: 0, secondPlaceCount: 0, thirdPlaceCount: 1 },
    { team: "utsav" as TeamId, totalPoints: 0, firstPlaceCount: 0, secondPlaceCount: 0, thirdPlaceCount: 0 },
    { team: "mba" as TeamId, totalPoints: 0, firstPlaceCount: 0, secondPlaceCount: 0, thirdPlaceCount: 0 },
  ];
  const writes: unknown[] = [];
  // The sheet as it was before MBA existed: four stale rows, row 6 empty.
  const fakeSheets = {
    spreadsheets: {
      values: {
        get: async () => ({ data: { values: [
          ["RAAGA", "0", "0", "0", "0"],
          ["AGNI", "0", "0", "0", "0"],
          ["TARANG", "0", "0", "0", "0"],
          ["UTSUV", "0", "0", "0", "0"],
        ] } }),
        update: async (request: unknown) => { writes.push(request); return {}; },
      },
    },
  };

  assert.equal(await synchronizeCalculatedRows(calculatedRows, fakeSheets as never, "test-spreadsheet"), true);
  assert.equal(writes.length, 1);
  const request = writes[0] as { range: string; requestBody: { values: string[][] } };
  assert.equal(request.range, CALCULATED_WRITE_RANGE);
  assert.equal(CALCULATED_WRITE_RANGE, "CALCULATED!A2:E6");
  assert.deepEqual(request.requestBody.values, [
    ["RAAGA", "20", "1", "0", "0"],
    ["AGNI", "8", "0", "1", "0"],
    ["TARANG", "5", "0", "0", "1"],
    ["UTSUV", "0", "0", "0", "0"],
    ["MBA", "0", "0", "0", "0"],
  ]);
  assert.deepEqual(calculatedRowsToSheetValues(calculatedRows), request.requestBody.values);
});

test("CALCULATED sync skips unchanged rows and prevents duplicate appends", async () => {
  const rows = calculatedRowsForManualTests();
  const existing = calculatedRowsToSheetValues(rows);
  let updateCount = 0;
  const fakeSheets = {
    spreadsheets: {
      values: {
        get: async () => ({ data: { values: existing } }),
        update: async () => { updateCount++; return {}; },
      },
    },
  };

  assert.equal(await synchronizeCalculatedRows(rows, fakeSheets as never, "test-spreadsheet"), false);
  assert.equal(updateCount, 0);
});

test("CALCULATED sync failure is contained and does not affect calculation", async () => {
  const fakeSheets = {
    spreadsheets: {
      values: {
        get: async () => { throw new Error("write/read failure"); },
        update: async () => { throw new Error("must not be called"); },
      },
    },
  };
  const rows = calculatedRowsForManualTests();
  assert.equal(await synchronizeCalculatedRows(rows, fakeSheets as never, "test-spreadsheet"), false);
  assert.equal(rows.find((row) => row.team === "raaga")!.totalPoints, 100);
});

// ─── SECTION 12: calculateTeamStandings() — lib/scoring.ts ───────────────────

section("12. calculateTeamStandings() — tie-breaker removed");

test("equal points → equal position (no firstCount tie-breaker)", () => {
  // raaga has 2 first-place wins, agni has 0 — but totals are equal
  // Under the old (buggy) code, raaga would be ranked above agni.
  // Under the fixed code both must share rank 1.
  const mockResults: Record<string, { eventId: string; placements: { placement: 1|2|3; participantOrTeamName: string; teamId: TeamId; pointsAwarded: number }[]; isDemoData: boolean }> = {
    "ev1": {
      eventId: "ev1",
      placements: [
        { placement: 1, participantOrTeamName: "", teamId: "raaga", pointsAwarded: 10 },
        { placement: 2, participantOrTeamName: "", teamId: "agni",  pointsAwarded: 7 },
      ],
      isDemoData: false,
    },
    "ev2": {
      eventId: "ev2",
      placements: [
        { placement: 1, participantOrTeamName: "", teamId: "raaga", pointsAwarded: 10 },
        { placement: 2, participantOrTeamName: "", teamId: "agni",  pointsAwarded: 7 },
      ],
      isDemoData: false,
    },
  };

  // Without event meta, scoring falls back to pointsAwarded so we can test
  // the ranking code in isolation. Both teams will have 10+10=20 pts each.
  const standings = calculateTeamStandings(TEAMS, mockResults as never, {});
  const raagaStanding = standings.find(s => s.team.id === "raaga")!;
  const agniStanding  = standings.find(s => s.team.id === "agni")!;

  // raaga gets 10+10=20 from pointsAwarded (legacy fallback path)
  // agni  gets  7+ 7=14 — so they're NOT equal in this test
  // Adjust: use equal pointsAwarded
  const equalResults: Record<string, { eventId: string; placements: { placement: 1|2|3; participantOrTeamName: string; teamId: TeamId; pointsAwarded: number }[]; isDemoData: boolean }> = {
    "ev3": {
      eventId: "ev3",
      placements: [
        { placement: 1, participantOrTeamName: "", teamId: "raaga", pointsAwarded: 20 },
        { placement: 1, participantOrTeamName: "", teamId: "agni",  pointsAwarded: 20 },
      ],
      isDemoData: false,
    },
  };
  const s2 = calculateTeamStandings(TEAMS, equalResults as never, {});
  const r2 = s2.find(s => s.team.id === "raaga")!;
  const a2 = s2.find(s => s.team.id === "agni")!;

  assert.equal(r2.totalPoints, 20);
  assert.equal(a2.totalPoints, 20);
  assert.equal(r2.position, a2.position,
    `Equal points must share rank. raaga=${r2.position}, agni=${a2.position}`);
  assert.equal(r2.position, 1, "Tied leaders must both be rank 1");

  void raagaStanding; void agniStanding; // used above
});

test("zero results → all teams position 1 (no points, no ordering)", () => {
  const standings = calculateTeamStandings(TEAMS, {}, {});
  standings.forEach(s => {
    assert.equal(s.totalPoints, 0);
    assert.equal(s.position,    1);
  });
});

// ─── SECTION 13: schedule projectEvent() parsing ─────────────────────────────

section("13. Schedule projection — schedule string parsing");

// Re-implement projectEvent inline to test parsing logic without imports
function parseScheduleString(scheduleStr: string | undefined): {
  date: string | null; startTime: string | null; endTime: string | null;
} {
  let date: string | null = null;
  let startTime: string | null = null;
  let endTime: string | null = null;
  if (scheduleStr) {
    const commaParts = scheduleStr.split(",");
    date = commaParts[0].trim() || null;
    if (commaParts.length > 1) {
      const timePart = commaParts.slice(1).join(",").trim();
      const dashIdx  = timePart.indexOf(" - ");
      if (dashIdx !== -1) {
        startTime = timePart.slice(0, dashIdx).trim() || null;
        endTime   = timePart.slice(dashIdx + 3).trim() || null;
      } else {
        startTime = timePart || null;
      }
    }
  }
  return { date, startTime, endTime };
}

test("full schedule string parses correctly", () => {
  const r = parseScheduleString("2026-01-15, 09:00 AM - 10:30 AM");
  assert.equal(r.date,      "2026-01-15");
  assert.equal(r.startTime, "09:00 AM");
  assert.equal(r.endTime,   "10:30 AM");
});

test("date + startTime only (no endTime)", () => {
  const r = parseScheduleString("2026-01-15, 09:00 AM");
  assert.equal(r.date,      "2026-01-15");
  assert.equal(r.startTime, "09:00 AM");
  assert.equal(r.endTime,    null);
});

test("date only → startTime and endTime null", () => {
  const r = parseScheduleString("2026-01-15");
  assert.equal(r.date,      "2026-01-15");
  assert.equal(r.startTime, null);
  assert.equal(r.endTime,    null);
});

test("undefined schedule → all null", () => {
  const r = parseScheduleString(undefined);
  assert.equal(r.date,      null);
  assert.equal(r.startTime, null);
  assert.equal(r.endTime,    null);
});

test("empty string schedule → all null", () => {
  const r = parseScheduleString("");
  assert.equal(r.date,      null);
  assert.equal(r.startTime, null);
  assert.equal(r.endTime,    null);
});

// ─── SECTION 14: eventId validation regex ────────────────────────────────────

section("14. eventId validation (allowlist regex from API routes)");

const EVENT_ID_RE = /^[a-zA-Z0-9_-]{1,100}$/;

test("valid slugs accepted", () => {
  assert.ok(EVENT_ID_RE.test("group-dance"));
  assert.ok(EVENT_ID_RE.test("bharathanaatyam"));
  assert.ok(EVENT_ID_RE.test("painting-relay"));
  assert.ok(EVENT_ID_RE.test("ev123"));
  assert.ok(EVENT_ID_RE.test("A_B-C"));
});

test("empty string rejected", () =>
  assert.equal(EVENT_ID_RE.test(""),        false));
test("string > 100 chars rejected", () =>
  assert.equal(EVENT_ID_RE.test("a".repeat(101)), false));
test("path traversal rejected", () =>
  assert.equal(EVENT_ID_RE.test("../etc/passwd"), false));
test("shell injection rejected", () =>
  assert.equal(EVENT_ID_RE.test("ev; DROP TABLE"), false));
test("log injection newline rejected", () =>
  assert.equal(EVENT_ID_RE.test("ev\nINJECTED"), false));
test("unicode rejected", () =>
  assert.equal(EVENT_ID_RE.test("évènement"), false));

// ─── SECTION 15: Sheets row parser — competition.ts logic ────────────────────

section("15. Sheets row parser (inline simulation)");

// Simulate the header-discovery + row-parsing from competition.ts fetchEvents()
function parseEventRow(
  headers: string[],
  row: string[]
): { id: string; pointsCategory: string; status: string } | null {
  const norm = (h: string) => h.toLowerCase().replace(/_/g, " ").trim();
  const hs = headers.map(norm);
  const idIdx       = hs.findIndex(h => h === "id" || h === "event id");
  const pointsCatIdx= hs.findIndex(h => h === "points category" || h === "pointscategory");
  const statusIdx   = hs.findIndex(h => h === "status");

  if (!row || row.every(c => !c || c.trim() === "")) return null;
  const id = idIdx >= 0 ? (row[idIdx] ?? "").trim() : "";
  if (!id) return null;
  const rawPointsCat = pointsCatIdx >= 0
    ? (row[pointsCatIdx] ?? "").trim().toLowerCase().replace(/[\s-]/g, "")
    : "";
  const rawStatus = statusIdx >= 0 ? (row[statusIdx] ?? "").trim().toLowerCase() : "upcoming";
  const pointsCategory = rawPointsCat === "group" ? "group"
    : rawPointsCat === "duo" ? "duo"
    : rawPointsCat === "offstage" ? "offstage"
    : "solo";
  const status = rawStatus === "completed" ? "completed"
    : rawStatus === "live" ? "live"
    : "upcoming";
  return { id, pointsCategory, status };
}

const testHeaders = ["ID", "Name", "Category", "POINTS_CATEGORY", "STATUS"];

test("normal row parses correctly", () => {
  const row = ["group-dance", "Group Dance", "on-stage", "group", "completed"];
  const r = parseEventRow(testHeaders, row);
  assert.ok(r);
  assert.equal(r!.id,             "group-dance");
  assert.equal(r!.pointsCategory, "group");
  assert.equal(r!.status,         "completed");
});

test("blank row returns null", () => {
  const r = parseEventRow(testHeaders, ["", "", "", "", ""]);
  assert.equal(r, null);
});

test("row missing id returns null", () => {
  const r = parseEventRow(testHeaders, ["", "Some Name", "on-stage", "solo", "upcoming"]);
  assert.equal(r, null);
});

test("offstage pointsCategory normalised correctly", () => {
  const row = ["painting-relay", "Painting Relay", "off-stage", "off-stage", "completed"];
  const r = parseEventRow(["ID", "Name", "Category", "Points Category", "STATUS"], row);
  assert.ok(r);
  assert.equal(r!.pointsCategory, "offstage");
});

test("unknown status defaults to upcoming", () => {
  const row = ["ev1", "Event 1", "on-stage", "solo", "INVALID_STATUS"];
  const r = parseEventRow(testHeaders, row);
  assert.ok(r);
  assert.equal(r!.status, "upcoming");
});

test("short row (fewer cells than headers) does not throw", () => {
  // Row only has id — all other fields missing
  const r = parseEventRow(testHeaders, ["ev1"]);
  assert.ok(r); // id found — row is valid
  assert.equal(r!.id, "ev1");
  assert.equal(r!.pointsCategory, "solo");   // default
  assert.equal(r!.status,         "upcoming"); // default
});

// ─── SECTION 16: MBA — the fifth team ────────────────────────────────────────

section("16. MBA — fifth team");

test("parseTeamId accepts every canonical team, case/whitespace-insensitive", () => {
  assert.equal(parseTeamId("MBA"), "mba");
  assert.equal(parseTeamId("  mba "), "mba");
  assert.equal(parseTeamId("RAAGA"), "raaga");
  assert.equal(parseTeamId("Agni"), "agni");
  assert.equal(parseTeamId("TARANG"), "tarang");
  assert.equal(parseTeamId("UTSAV"), "utsav");
});

test("parseTeamId maps the CALCULATED-tab spelling UTSUV to utsav", () => {
  assert.equal(parseTeamId("UTSUV"), "utsav");
});

test("parseTeamId rejects blank and unknown teams instead of guessing", () => {
  assert.equal(parseTeamId(""), null);
  assert.equal(parseTeamId("   "), null);
  assert.equal(parseTeamId(undefined), null);
  assert.equal(parseTeamId("MBA2"), null);
  assert.equal(parseTeamId("staff"), null);
});

test("MBA appears with zero points and zero placements when it has no results", () => {
  const rows = calculateCalculatedLeaderboard([calculatedEvent("g1", "group", "completed")], [
    calculatedResult("g1", "raaga", 1),
  ]);
  const mba = rows.find((row) => row.team === "mba");
  assert.ok(mba, "MBA row must be present");
  assert.deepEqual(
    [mba!.totalPoints, mba!.firstPlaceCount, mba!.secondPlaceCount, mba!.thirdPlaceCount],
    [0, 0, 0, 0]
  );
});

test("MBA earns official points per category and correct placement counts", () => {
  const rows = calculateCalculatedLeaderboard(
    [
      calculatedEvent("g", "group", "completed"),
      calculatedEvent("d", "duo", "completed"),
      calculatedEvent("s", "solo", "completed"),
      calculatedEvent("o", "offstage", "completed"),
    ],
    [
      calculatedResult("g", "mba", 1, 999), // 20, not 999
      calculatedResult("d", "mba", 2, 999), // 8
      calculatedResult("s", "mba", 3, 999), // 5
      calculatedResult("o", "mba", 3, 999), // 3
    ]
  );
  const mba = rows.find((row) => row.team === "mba")!;
  assert.equal(mba.totalPoints, 36);
  assert.equal(mba.firstPlaceCount, 1);
  assert.equal(mba.secondPlaceCount, 1);
  assert.equal(mba.thirdPlaceCount, 2);
  // Nobody else is credited for MBA's results.
  assert.ok(rows.filter((row) => row.team !== "mba").every((row) => row.totalPoints === 0));
});

test("MBA results in upcoming events earn nothing", () => {
  const rows = calculateCalculatedLeaderboard(
    [calculatedEvent("u", "group", "upcoming")],
    [calculatedResult("u", "mba", 1)]
  );
  assert.equal(rows.find((row) => row.team === "mba")!.totalPoints, 0);
});

test("calculateTeamStandings includes MBA", () => {
  const standings = calculateTeamStandings(TEAMS, {}, {});
  assert.ok(standings.some((s) => s.team.id === "mba"));
  assert.equal(standings.length, 5);
});

test("MBA MANUAL blank → uses calculated total", () => {
  const mba = calculateEffectiveLeaderboard(calculatedRowsForManualTests(), [])
    .find((row) => row.team === "mba")!;
  assert.equal(mba.totalPoints, 30);
  assert.equal(mba.manualTotal, null);
});

test("MBA MANUAL zero → valid override to 0", () => {
  const mba = calculateEffectiveLeaderboard(calculatedRowsForManualTests(), [manualRow("mba", 0)])
    .find((row) => row.team === "mba")!;
  assert.equal(mba.totalPoints, 0);
  assert.equal(mba.manualTotal, 0);
  assert.equal(mba.calculatedPoints, 30);
});

test("MBA MANUAL positive → override; placement counts unchanged", () => {
  const mba = calculateEffectiveLeaderboard(calculatedRowsForManualTests(), [manualRow("mba", 120)])
    .find((row) => row.team === "mba")!;
  assert.equal(mba.totalPoints, 120);
  assert.equal(mba.rank, 1);
  assert.equal(mba.pointGap, 0);
  assert.equal(mba.firstPlaceCount, 1);
  assert.equal(mba.secondPlaceCount, 0);
  assert.equal(mba.thirdPlaceCount, 2);
});

test("MBA MANUAL invalid text → falls back to calculated", () => {
  const mba = calculateEffectiveLeaderboard(calculatedRowsForManualTests(), [manualRow("mba", "lots")])
    .find((row) => row.team === "mba")!;
  assert.equal(mba.totalPoints, 30);
  assert.equal(mba.manualTotal, null);
});

test("MBA MANUAL negative → falls back to calculated", () => {
  const mba = calculateEffectiveLeaderboard(calculatedRowsForManualTests(), [manualRow("mba", -10)])
    .find((row) => row.team === "mba")!;
  assert.equal(mba.totalPoints, 30);
  assert.equal(mba.manualTotal, null);
});

test("MBA tied with another team shares the rank; next rank skips", () => {
  // RAAGA 100, AGNI 80, TARANG 60, MBA set to 80 manually, UTSAV 0
  const rows = calculateEffectiveLeaderboard(calculatedRowsForManualTests(), [manualRow("mba", 80)]);
  const byTeam = Object.fromEntries(rows.map((row) => [row.team, row]));
  assert.equal(byTeam.raaga.rank, 1);
  assert.equal(byTeam.agni.rank, 2);
  assert.equal(byTeam.mba.rank, 2);
  assert.equal(byTeam.tarang.rank, 4);
  assert.equal(byTeam.utsav.rank, 5);
  assert.equal(byTeam.mba.pointGap, 20);
});

/** A fake Sheets client that keeps the CALCULATED range in memory. */
function inMemoryCalculatedSheet(initial: string[][]) {
  let stored = initial.map((row) => [...row]);
  const calls = { get: 0, update: 0, append: 0 };
  const client = {
    spreadsheets: {
      values: {
        get: async () => { calls.get++; return { data: { values: stored } }; },
        update: async (request: { requestBody: { values: string[][] } }) => {
          calls.update++;
          stored = request.requestBody.values.map((row) => [...row]);
          return {};
        },
        append: async () => { calls.append++; return {}; },
      },
    },
  };
  return { client, calls, read: () => stored };
}

test("repeated CALCULATED sync writes once and never duplicates the MBA row", async () => {
  const rows = calculatedRowsForManualTests();
  const sheet = inMemoryCalculatedSheet([]);
  assert.equal(await synchronizeCalculatedRows(rows, sheet.client as never, "t"), true);
  assert.equal(await synchronizeCalculatedRows(rows, sheet.client as never, "t"), false);
  assert.equal(await synchronizeCalculatedRows(rows, sheet.client as never, "t"), false);
  assert.equal(sheet.calls.update, 1);
  assert.equal(sheet.calls.append, 0);
  const stored = sheet.read();
  assert.equal(stored.length, 5);
  assert.equal(stored.filter((row) => row[0] === "MBA").length, 1);
  assert.deepEqual(stored[4], ["MBA", "30", "1", "0", "2"]);
});

test("CALCULATED sync refuses to overwrite a row labelled for another purpose", async () => {
  const sheet = inMemoryCalculatedSheet([
    ["RAAGA", "0", "0", "0", "0"],
    ["AGNI", "0", "0", "0", "0"],
    ["TARANG", "0", "0", "0", "0"],
    ["UTSUV", "0", "0", "0", "0"],
    ["TOTAL", "0", "0", "0", "0"], // unexpected content where MBA belongs
  ]);
  const originalError = console.error;
  console.error = () => {}; // the refusal is logged; keep test output clean
  try {
    assert.equal(
      await synchronizeCalculatedRows(calculatedRowsForManualTests(), sheet.client as never, "t"),
      false
    );
  } finally {
    console.error = originalError;
  }
  assert.equal(sheet.calls.update, 0);
  assert.equal(sheet.read()[4][0], "TOTAL");
});

test("RESULTS rows map to the right team, including MBA", () => {
  const header = ["RESULT_ID", "EVENT_ID", "EVENT_NAME", "POSITION", "ENTRY_NAME", "TEAM", "POINTS"];
  const map = parseResultRows([
    header,
    ["R1-1", "E1", "GROUP DANCE", "1", "MBA Crew", "MBA", "999"],
    ["R1-2", "E1", "GROUP DANCE", "2", "Raaga Crew", "RAAGA", ""],
    ["R1-3", "E1", "GROUP DANCE", "3", "Utsav Crew", "UTSAV", ""],
  ]);
  const placements = map.get("E1")!;
  assert.deepEqual(placements.map((p) => [p.placement, p.teamId]), [[1, "mba"], [2, "raaga"], [3, "utsav"]]);
  assert.ok(placements.every((p) => p.pointsAwarded === 0), "sheet POINTS must not be trusted");
});

test("RESULTS rows with a blank or unknown TEAM are skipped, not given to RAAGA", () => {
  const header = ["RESULT_ID", "EVENT_ID", "EVENT_NAME", "POSITION", "ENTRY_NAME", "TEAM", "POINTS"];
  const map = parseResultRows([
    header,
    ["R1-1", "E1", "DUO DANCE", "1"],                       // position pre-filled, no team yet
    ["R1-2", "E1", "DUO DANCE", "2", "Someone", ""],
    ["R1-3", "E1", "DUO DANCE", "3", "Someone", "GUESTS"], // not a team
    ["R2-1", "E2", "SOLO SONG", "1", "Singer", "MBA"],
  ]);
  assert.equal(map.has("E1"), false);
  assert.deepEqual(map.get("E2")!.map((p) => p.teamId), ["mba"]);
});

test("end to end: an MBA RESULTS row scores MBA through the official table", () => {
  const header = ["EVENT_ID", "POSITION", "ENTRY_NAME", "TEAM"];
  const map = parseResultRows([header, ["E9", "1", "x", "MBA"]]);
  const results: CompetitionEventResult[] = [...map.entries()].map(([eventId, placements]) => ({
    eventId,
    placements,
    isDemoData: false,
  }));
  const rows = calculateCalculatedLeaderboard([calculatedEvent("E9", "solo", "completed")], results);
  assert.equal(rows.find((row) => row.team === "mba")!.totalPoints, 10);
  assert.equal(rows.find((row) => row.team === "raaga")!.totalPoints, 0);
});

test("Team Lookup house cards: the four houses still resolve; MBA has none", () => {
  for (const team of ["RAAGA", "AGNI", "TARANG", "UTSAV"]) {
    const house = resolveHouse(team);
    assert.ok(house, `${team} must still resolve to its house card`);
    assert.equal(house!.name, team);
    assert.ok(house!.frontImage.includes(team.toLowerCase()));
    assert.ok(house!.backImage.includes(team.toLowerCase()));
  }
  assert.equal(resolveHouse("MBA"), null);
  assert.equal(resolveHouse("mba"), null);
  assert.equal(resolveHouse(""), null);
});

// ─── SUMMARY ─────────────────────────────────────────────────────────────────

Promise.all(pending).then(() => {
console.log(`\n${"═".repeat(64)}`);
console.log(`  MUDRA 2026 Audit — ${passed + failed} tests total`);
console.log(`  ✓ PASSED: ${passed}`);
if (failed > 0) {
  console.log(`  ✗ FAILED: ${failed}`);
  failures.forEach(f => console.error(`    • ${f}`));
  process.exit(1);
} else {
  console.log("  All tests passed.\n");
}
});
