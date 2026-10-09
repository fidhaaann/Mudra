import { after } from 'next/server';
import { fetchEvents, fetchResults, getSheetsClient } from './competition';
import { getGoogleEnvVars } from '../security/env';
import { cachedLoad, describeError, describeFreshness } from '../cache';
import { TeamId } from '@/types/team';
import { CALCULATED_SHEET_LABELS, TEAMS, parseTeamId } from '@/data/teams';
import { Event } from '@/types/event';
import { EventResult } from '@/types/result';
import {
  CalculatedLeaderboardRow,
  EffectiveLeaderboardRow,
  LeaderboardResponse,
  LeaderboardTeamId,
  ManualLeaderboardRow,
  PointsCategory,
  TeamLeaderboardEntry,
} from '@/types/leaderboard';

/** MANUAL / CALCULATED tab reads: same freshness as RESULTS (see ../cache). */
const SHEET_CACHE = { ttlMs: 30_000, staleMs: 20 * 60_000 };
/** One row per canonical team, below the header (A2:E6 for five teams). */
export const CALCULATED_WRITE_RANGE = `CALCULATED!A2:E${TEAMS.length + 1}`;
/**
 * After a successful sync, identical rows are not re-checked against the
 * sheet for this long (a changed result triggers a sync immediately). The
 * periodic re-check repairs manual edits to the CALCULATED tab.
 */
const CALCULATED_RECHECK_MS = 5 * 60_000;

let lastCalculatedSyncFingerprint: string | null = null;
let lastCalculatedSyncAt = 0;
let calculatedSyncInFlight: Promise<void> | null = null;

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumber(value: unknown): number | null {
  const normalized = String(value ?? '').replace(/,/g, '').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchLeaderboardSheetRows(range: 'CALCULATED!A:E' | 'MANUAL!A:D'): Promise<unknown[][]> {
  const { competitionSpreadsheetId } = getGoogleEnvVars();
  const sheets = getSheetsClient();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: competitionSpreadsheetId,
      range,
    });
    return (response.data.values ?? []) as unknown[][];
  } catch (error) {
    // Never log the raw error: Google API errors carry the auth header.
    console.error('Error fetching leaderboard sheets from Google Sheets:', { range, ...describeError(error) });
    throw new Error('Failed to retrieve leaderboard sheet data.');
  }
}

function getColumnIndexes(headers: unknown[], required: string[]) {
  const normalizedHeaders = headers.map(normalizeHeader);
  return required.map((header) => normalizedHeaders.indexOf(header));
}

/**
 * Reads the CALCULATED tab for the next-stage leaderboard integration.
 * This is intentionally separate from buildLeaderboard so official scoring
 * remains the current source of truth.
 */
export function fetchCalculatedLeaderboard(): Promise<CalculatedLeaderboardRow[]> {
  return cachedLoad('calculated', SHEET_CACHE, loadCalculatedLeaderboard);
}

async function loadCalculatedLeaderboard(): Promise<CalculatedLeaderboardRow[]> {
  const rows = await fetchLeaderboardSheetRows('CALCULATED!A:E');
  const [teamIdx, totalIdx, firstIdx, secondIdx, thirdIdx] = getColumnIndexes(
    rows[0] ?? [],
    ['team', 'total points', '1st', '2nd', '3rd']
  );
  if ([teamIdx, totalIdx, firstIdx, secondIdx, thirdIdx].some((index) => index < 0)) {
    return [];
  }

  const data: CalculatedLeaderboardRow[] = [];
  for (const row of rows.slice(1)) {
    if (!row?.length || row.every((cell) => !String(cell ?? '').trim())) continue;
    const team = parseTeamId(row[teamIdx]);
    const totalPoints = parseNumber(row[totalIdx]);
    const firstPlaceCount = parseNumber(row[firstIdx]);
    const secondPlaceCount = parseNumber(row[secondIdx]);
    const thirdPlaceCount = parseNumber(row[thirdIdx]);
    if (
      !team ||
      totalPoints === null ||
      firstPlaceCount === null ||
      secondPlaceCount === null ||
      thirdPlaceCount === null
    ) continue;
    data.push({ team, totalPoints, firstPlaceCount, secondPlaceCount, thirdPlaceCount });
  }

  return data;
}

/**
 * Reads the MANUAL tab for the next-stage override integration.
 * Manual values are read and validated but do not affect official totals yet.
 */
export function fetchManualLeaderboard(): Promise<ManualLeaderboardRow[]> {
  return cachedLoad('manual', SHEET_CACHE, loadManualLeaderboard);
}

async function loadManualLeaderboard(): Promise<ManualLeaderboardRow[]> {
  const rows = await fetchLeaderboardSheetRows('MANUAL!A:D');

  const [teamIdx, totalIdx, noteIdx, updatedIdx] = getColumnIndexes(
    rows[0] ?? [],
    ['team', 'total points', 'note', 'last updated']
  );
  if ([teamIdx, totalIdx, noteIdx, updatedIdx].some((index) => index < 0)) {
    return [];
  }

  const data: ManualLeaderboardRow[] = [];
  for (const row of rows.slice(1)) {
    if (!row?.length || row.every((cell) => !String(cell ?? '').trim())) continue;
    const team = parseTeamId(row[teamIdx]);
    const totalPoints = parseNumber(row[totalIdx]);
    if (!team || totalPoints === null) continue;
    data.push({
      team,
      totalPoints,
      note: String(row[noteIdx] ?? '').trim(),
      lastUpdated: String(row[updatedIdx] ?? '').trim(),
    });
  }

  return data;
}

const OFFICIAL_SCORING: Record<PointsCategory, Record<1 | 2 | 3, number>> = {
  group:    { 1: 20, 2: 15, 3: 10 },
  duo:      { 1: 12, 2:  8, 3:  5 },
  solo:     { 1: 10, 2:  7, 3:  5 },
  offstage: { 1:  8, 2:  5, 3:  3 },
};

/**
 * Calculates the server-side CALCULATED rows from finished event results.
 * The volunteer-entered pointsAwarded value is deliberately ignored.
 */
export function calculateCalculatedLeaderboard(
  events: Event[],
  results: EventResult[]
): CalculatedLeaderboardRow[] {
  const totals = new Map<LeaderboardTeamId, CalculatedLeaderboardRow>(
    TEAMS.map(({ id }) => [
      id,
      {
        team: id,
        totalPoints: 0,
        firstPlaceCount: 0,
        secondPlaceCount: 0,
        thirdPlaceCount: 0,
      },
    ])
  );
  const eventMap = new Map(events.map((event) => [event.id.toLowerCase(), event]));

  for (const result of results) {
    const event = eventMap.get(result.eventId.toLowerCase());
    if (!event || !['completed', 'finished'].includes(String(event.status).toLowerCase())) {
      continue;
    }

    for (const placement of result.placements) {
      const position = placement.placement;
      if (position !== 1 && position !== 2 && position !== 3) continue;
      const team = totals.get(placement.teamId);
      const points = OFFICIAL_SCORING[event.pointsCategory]?.[position];
      if (!team || points === undefined) continue;

      team.totalPoints += points;
      if (position === 1) team.firstPlaceCount++;
      else if (position === 2) team.secondPlaceCount++;
      else team.thirdPlaceCount++;
    }
  }

  return TEAMS.map(({ id }) => totals.get(id)!);
}

export function calculatedRowsToSheetValues(
  rows: CalculatedLeaderboardRow[]
): string[][] {
  const rowsByTeam = new Map(rows.map((row) => [row.team, row]));
  return TEAMS.map(({ id }) => {
    const row = rowsByTeam.get(id);
    return [
      CALCULATED_SHEET_LABELS[id],
      String(row?.totalPoints ?? 0),
      String(row?.firstPlaceCount ?? 0),
      String(row?.secondPlaceCount ?? 0),
      String(row?.thirdPlaceCount ?? 0),
    ];
  });
}

function sheetValuesMatch(existing: unknown[][], expected: string[][]): boolean {
  return expected.every((expectedRow, rowIndex) =>
    expectedRow.every(
      (expectedCell, columnIndex) =>
        String(existing[rowIndex]?.[columnIndex] ?? '').trim() === expectedCell
    )
  );
}

/**
 * Rows in the write range whose TEAM cell holds a label other than the one
 * this sync would write there. A blank cell is fine (the row is new, e.g. the
 * first sync after a team is added); anything else means the sheet layout is
 * not what the backend expects, so writing would overwrite unrelated data.
 */
function unexpectedTeamLabels(existing: unknown[][], expected: string[][]): string[] {
  const problems: string[] = [];
  expected.forEach((expectedRow, rowIndex) => {
    const label = String(existing[rowIndex]?.[0] ?? '').trim();
    if (label && label.toUpperCase() !== expectedRow[0]) {
      problems.push(`row ${rowIndex + 2}: found "${label}", expected "${expectedRow[0]}"`);
    }
  });
  return problems;
}

type SheetsValuesClient = ReturnType<typeof getSheetsClient>;

/**
 * Synchronizes only the fixed CALCULATED data range (one row per canonical
 * team, in TEAMS order). It never appends, so repeated syncs cannot create
 * duplicate rows; the read-before-write comparison skips unchanged data; and
 * the write is refused if any existing TEAM label in the range belongs to a
 * different team than the row being written.
 */
export async function synchronizeCalculatedRows(
  rows: CalculatedLeaderboardRow[],
  sheets: SheetsValuesClient = getSheetsClient(),
  spreadsheetId = getGoogleEnvVars().competitionSpreadsheetId
): Promise<boolean> {
  return (await syncCalculatedRows(rows, sheets, spreadsheetId)) === 'written';
}

type SyncOutcome = 'written' | 'unchanged' | 'refused' | 'failed';

async function syncCalculatedRows(
  rows: CalculatedLeaderboardRow[],
  sheets: SheetsValuesClient,
  spreadsheetId: string
): Promise<SyncOutcome> {
  const expected = calculatedRowsToSheetValues(rows);

  try {
    const current = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: CALCULATED_WRITE_RANGE,
    });
    const existing = (current.data.values ?? []) as unknown[][];
    if (sheetValuesMatch(existing, expected)) return 'unchanged';

    const problems = unexpectedTeamLabels(existing, expected);
    if (problems.length > 0) {
      console.error('Calculated leaderboard synchronization skipped:', {
        operation: 'calculated-range-update',
        range: CALCULATED_WRITE_RANGE,
        reason: 'unexpected-team-labels',
        problems,
      });
      return 'refused';
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: CALCULATED_WRITE_RANGE,
      valueInputOption: 'RAW',
      requestBody: { values: expected },
    });
    return 'written';
  } catch (error) {
    console.error('Calculated leaderboard synchronization failed:', {
      operation: 'calculated-range-update',
      range: CALCULATED_WRITE_RANGE,
      reason: error instanceof Error ? error.message : 'unknown-error',
    });
    return 'failed';
  }
}

/**
 * One sync at a time per instance; identical rows are skipped until the
 * re-check interval passes. Only a sync that actually succeeded (written or
 * already identical) is recorded, so a failed write is retried on the next
 * leaderboard request instead of being treated as done.
 */
async function synchronizeCalculatedRowsOnce(rows: CalculatedLeaderboardRow[]): Promise<void> {
  const fingerprint = JSON.stringify(rows);
  const now = Date.now();
  if (
    fingerprint === lastCalculatedSyncFingerprint &&
    now - lastCalculatedSyncAt < CALCULATED_RECHECK_MS
  ) {
    return;
  }
  if (calculatedSyncInFlight) return calculatedSyncInFlight;

  calculatedSyncInFlight = syncCalculatedRows(
    rows,
    getSheetsClient(),
    getGoogleEnvVars().competitionSpreadsheetId
  )
    .then((outcome) => {
      if (outcome === 'written' || outcome === 'unchanged') {
        lastCalculatedSyncFingerprint = fingerprint;
        lastCalculatedSyncAt = Date.now();
      }
    })
    .catch((error) => {
      console.error('Calculated leaderboard synchronization failed:', describeError(error));
    })
    .finally(() => {
      calculatedSyncInFlight = null;
    });
  return calculatedSyncInFlight;
}

/**
 * Run the CALCULATED sync after the response is sent, so a slow or failing
 * sheet write never delays or breaks the public leaderboard. Outside a
 * request scope (scripts, tests) `after` is unavailable; the sync then runs
 * in the background with its errors contained.
 */
function scheduleCalculatedSync(rows: CalculatedLeaderboardRow[]): void {
  try {
    after(() => synchronizeCalculatedRowsOnce(rows));
  } catch {
    void synchronizeCalculatedRowsOnce(rows);
  }
}

/**
 * Applies valid non-negative MANUAL totals to calculated rows. Manual values
 * affect only effective totals, ranks, and gaps; calculated statistics remain
 * sourced from competition results.
 */
export function calculateEffectiveLeaderboard(
  calculatedRows: CalculatedLeaderboardRow[],
  manualRows: ManualLeaderboardRow[]
): EffectiveLeaderboardRow[] {
  const manualByTeam = new Map(manualRows.map((row) => [row.team, row]));
  const effective = calculatedRows.map((row) => {
    const manualTotal = manualByTeam.get(row.team)?.totalPoints;
    const validManual = typeof manualTotal === 'number' &&
      Number.isFinite(manualTotal) &&
      manualTotal >= 0;
    const totalPoints = validManual ? manualTotal : row.totalPoints;

    return {
      ...row,
      calculatedPoints: row.totalPoints,
      manualTotal: validManual ? manualTotal : null,
      totalPoints,
      rank: 0,
      pointGap: 0,
    };
  });

  const maxPoints = Math.max(...effective.map((row) => row.totalPoints), 0);
  effective.sort((a, b) => b.totalPoints - a.totalPoints);
  for (let index = 0; index < effective.length; index++) {
    effective[index].pointGap = maxPoints - effective[index].totalPoints;
    effective[index].rank =
      index === 0 || effective[index].totalPoints !== effective[index - 1].totalPoints
        ? index + 1
        : effective[index - 1].rank;
  }

  return effective;
}

export async function buildLeaderboard(): Promise<LeaderboardResponse> {
  // All three in parallel. fetchResults() also needs the events list; the
  // cache coalesces that into the same single EVENTS read, so this costs no
  // extra Sheets call and never waits on two refreshes back to back.
  const [events, results, manualRows] = await Promise.all([
    fetchEvents(),
    fetchResults(),
    fetchManualLeaderboard(),
  ]);
  const freshness = describeFreshness(['events', 'results', 'manual']);
  const calculatedRows = calculateCalculatedLeaderboard(events, results);
  // Only sync from live data: a fallback copy may be older than what another
  // instance already wrote, and must never overwrite newer totals.
  if (freshness.dataStatus === 'live') scheduleCalculatedSync(calculatedRows);
  const effectiveRows = calculateEffectiveLeaderboard(calculatedRows, manualRows);
  const effectiveByTeam = new Map(effectiveRows.map((row) => [row.team, row]));

  // Build a map of event metadata keyed by id (lowercased for safe lookup)
  const eventMap = new Map(events.map(e => [e.id.toLowerCase(), e]));

  // Accumulator per team
  interface TeamAccumulator {
    totalPoints:      number;
    firstPlaceCount:  number;
    secondPlaceCount: number;
    thirdPlaceCount:  number;
    groupPoints:      number;
    duoPoints:        number;
    soloPoints:       number;
    offStagePoints:   number;
  }

  // One accumulator per canonical team, so every team is always returned.
  const acc = Object.fromEntries(
    TEAMS.map(({ id }) => [id, zero(effectiveByTeam.get(id))])
  ) as Record<TeamId, TeamAccumulator>;

  let completedEventCount = 0;
  const countedEventIds = new Set<string>();

  for (const result of results) {
    // results are already filtered to COMPLETED events by fetchResults()
    const event = eventMap.get(result.eventId.toLowerCase());
    if (!event) continue; // unknown event — skip

    const pointsCat = event.pointsCategory as PointsCategory;
    if (!countedEventIds.has(result.eventId.toLowerCase())) {
      countedEventIds.add(result.eventId.toLowerCase());
      completedEventCount++;
    }

    for (const placement of result.placements) {
      const pos = placement.placement;
      if (pos !== 1 && pos !== 2 && pos !== 3) continue;

      const team = acc[placement.teamId];
      if (!team) continue; // unrecognised team — skip

      // Always use official scoring, ignore any points value from the sheet.
      const officialPoints = OFFICIAL_SCORING[pointsCat]?.[pos];
      if (officialPoints === undefined) {
        console.warn(
          `[leaderboard] No scoring rule for category="${pointsCat}" position=${pos}. Skipping.`
        );
        continue;
      }

      if (pointsCat === 'group')    team.groupPoints    += officialPoints;
      else if (pointsCat === 'duo') team.duoPoints      += officialPoints;
      else if (pointsCat === 'solo') team.soloPoints    += officialPoints;
      else if (pointsCat === 'offstage') team.offStagePoints += officialPoints;
    }
  }

  // Find the highest total to compute gap
  const maxPoints = Math.max(...TEAMS.map(t => acc[t.id].totalPoints));

  // Build entries for every team, including teams with zero points
  const entries: TeamLeaderboardEntry[] = TEAMS.map(team => {
    const a = acc[team.id];
    return {
      teamId:           team.id,
      teamName:         team.name,
      rank:             0, // assigned below
      totalPoints:      a.totalPoints,
      pointGap:         maxPoints - a.totalPoints,
      firstPlaceCount:  a.firstPlaceCount,
      secondPlaceCount: a.secondPlaceCount,
      thirdPlaceCount:  a.thirdPlaceCount,
      groupPoints:      a.groupPoints,
      duoPoints:        a.duoPoints,
      soloPoints:       a.soloPoints,
      offStagePoints:   a.offStagePoints,
    };
  });

  // Sort by total points descending only — placement counts are statistics, not tie-breakers
  entries.sort((a, b) => b.totalPoints - a.totalPoints);

  // Standard competition ranking (1224, not 1223):
  // Teams with equal points share the same rank; the next distinct rank
  // equals the total number of teams ranked above it plus one.
  for (let i = 0; i < entries.length; i++) {
    if (i === 0 || entries[i].totalPoints !== entries[i - 1].totalPoints) {
      // rank = 1-based index of this entry (first in its points group)
      entries[i].rank = i + 1;
    } else {
      // same points as the previous entry → share its rank
      entries[i].rank = entries[i - 1].rank;
    }
  }

  return {
    teams: entries,
    completedEventCount,
    lastUpdated: freshness.dataAsOf,
    dataStatus: freshness.dataStatus,
  };
}

function zero(calculated?: EffectiveLeaderboardRow) {
  return {
    totalPoints:      calculated?.totalPoints ?? 0,
    firstPlaceCount:  calculated?.firstPlaceCount ?? 0,
    secondPlaceCount: calculated?.secondPlaceCount ?? 0,
    thirdPlaceCount:  calculated?.thirdPlaceCount ?? 0,
    groupPoints:      0,
    duoPoints:        0,
    soloPoints:       0,
    offStagePoints:   0,
  };
}
