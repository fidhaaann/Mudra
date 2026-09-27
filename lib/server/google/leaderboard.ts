import { fetchEvents, fetchResults, getSheetsClient } from './competition';
import { getGoogleEnvVars } from '../security/env';
import { TeamId } from '@/types/team';
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

const SHEET_CACHE_TTL_MS = 30_000;
export const CALCULATED_WRITE_RANGE = 'CALCULATED!A2:E5';
const CALCULATED_SYNC_TTL_MS = 30_000;

interface SheetCacheEntry<T> {
  data: T;
  expiresAt: number;
}

let calculatedCache: SheetCacheEntry<CalculatedLeaderboardRow[]> | null = null;
let manualCache: SheetCacheEntry<ManualLeaderboardRow[]> | null = null;
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

function parseTeam(value: unknown): LeaderboardTeamId | null {
  const team = String(value ?? '').trim().toLowerCase() as LeaderboardTeamId;
  return ['raaga', 'agni', 'tarang', 'utsav'].includes(team) ? team : null;
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
    console.error('Error fetching leaderboard sheets from Google Sheets:', error);
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
export async function fetchCalculatedLeaderboard(): Promise<CalculatedLeaderboardRow[]> {
  const now = Date.now();
  if (calculatedCache && calculatedCache.expiresAt > now) return calculatedCache.data;

  const rows = await fetchLeaderboardSheetRows('CALCULATED!A:E');
  const [teamIdx, totalIdx, firstIdx, secondIdx, thirdIdx] = getColumnIndexes(
    rows[0] ?? [],
    ['team', 'total points', '1st', '2nd', '3rd']
  );
  if ([teamIdx, totalIdx, firstIdx, secondIdx, thirdIdx].some((index) => index < 0)) {
    calculatedCache = { data: [], expiresAt: now + SHEET_CACHE_TTL_MS };
    return [];
  }

  const data: CalculatedLeaderboardRow[] = [];
  for (const row of rows.slice(1)) {
    if (!row?.length || row.every((cell) => !String(cell ?? '').trim())) continue;
    const team = parseTeam(row[teamIdx]);
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

  calculatedCache = { data, expiresAt: now + SHEET_CACHE_TTL_MS };
  return data;
}

/**
 * Reads the MANUAL tab for the next-stage override integration.
 * Manual values are read and validated but do not affect official totals yet.
 */
export async function fetchManualLeaderboard(): Promise<ManualLeaderboardRow[]> {
  const now = Date.now();
  if (manualCache && manualCache.expiresAt > now) return manualCache.data;

  const rows = await fetchLeaderboardSheetRows('MANUAL!A:D');

  const [teamIdx, totalIdx, noteIdx, updatedIdx] = getColumnIndexes(
    rows[0] ?? [],
    ['team', 'total points', 'note', 'last updated']
  );
  if ([teamIdx, totalIdx, noteIdx, updatedIdx].some((index) => index < 0)) {
    manualCache = { data: [], expiresAt: now + SHEET_CACHE_TTL_MS };
    return [];
  }

  const data: ManualLeaderboardRow[] = [];
  for (const row of rows.slice(1)) {
    if (!row?.length || row.every((cell) => !String(cell ?? '').trim())) continue;
    const team = parseTeam(row[teamIdx]);
    const totalPoints = parseNumber(row[totalIdx]);
    if (!team || totalPoints === null) continue;
    data.push({
      team,
      totalPoints,
      note: String(row[noteIdx] ?? '').trim(),
      lastUpdated: String(row[updatedIdx] ?? '').trim(),
    });
  }

  manualCache = { data, expiresAt: now + SHEET_CACHE_TTL_MS };
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
    ALL_TEAMS.map(({ id }) => [
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

  return ALL_TEAMS.map(({ id }) => totals.get(id)!);
}

export function calculatedRowsToSheetValues(
  rows: CalculatedLeaderboardRow[]
): string[][] {
  const rowsByTeam = new Map(rows.map((row) => [row.team, row]));
  return ALL_TEAMS.map(({ id }) => {
    const row = rowsByTeam.get(id);
    return [
      id === 'utsav' ? 'UTSUV' : id.toUpperCase(),
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

type SheetsValuesClient = ReturnType<typeof getSheetsClient>;

/**
 * Synchronizes only the fixed CALCULATED data range. The read-before-write
 * comparison prevents duplicate rows and unnecessary writes.
 */
export async function synchronizeCalculatedRows(
  rows: CalculatedLeaderboardRow[],
  sheets: SheetsValuesClient = getSheetsClient(),
  spreadsheetId = getGoogleEnvVars().competitionSpreadsheetId
): Promise<boolean> {
  const expected = calculatedRowsToSheetValues(rows);

  try {
    const current = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: CALCULATED_WRITE_RANGE,
    });
    const existing = (current.data.values ?? []) as unknown[][];
    if (sheetValuesMatch(existing, expected)) return false;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: CALCULATED_WRITE_RANGE,
      valueInputOption: 'RAW',
      requestBody: { values: expected },
    });
    return true;
  } catch (error) {
    console.error('Calculated leaderboard synchronization failed:', {
      operation: 'calculated-range-update',
      range: CALCULATED_WRITE_RANGE,
      reason: error instanceof Error ? error.message : 'unknown-error',
    });
    return false;
  }
}

async function synchronizeCalculatedRowsOnce(rows: CalculatedLeaderboardRow[]): Promise<void> {
  const fingerprint = JSON.stringify(rows);
  const now = Date.now();
  if (
    fingerprint === lastCalculatedSyncFingerprint &&
    now - lastCalculatedSyncAt < CALCULATED_SYNC_TTL_MS
  ) {
    return;
  }
  if (calculatedSyncInFlight) return calculatedSyncInFlight;

  calculatedSyncInFlight = synchronizeCalculatedRows(rows)
    .then(() => {
      lastCalculatedSyncFingerprint = fingerprint;
      lastCalculatedSyncAt = Date.now();
    })
    .finally(() => {
      calculatedSyncInFlight = null;
    });
  return calculatedSyncInFlight;
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

// Official scoring table — source of truth, never override with sheet values
const ALL_TEAMS: { id: TeamId; name: string }[] = [
  { id: 'raaga',  name: 'RAAGA'  },
  { id: 'agni',   name: 'AGNI'   },
  { id: 'tarang', name: 'TARANG' },
  { id: 'utsav',  name: 'UTSAV'  },
];

export async function buildLeaderboard(): Promise<LeaderboardResponse> {
  // Fetch both in parallel
  const [events, results, manualRows] = await Promise.all([
    fetchEvents(),
    fetchResults(),
    fetchManualLeaderboard(),
  ]);
  const calculatedRows = calculateCalculatedLeaderboard(events, results);
  await synchronizeCalculatedRowsOnce(calculatedRows);
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

  const acc: Record<TeamId, TeamAccumulator> = {
    raaga:  zero(effectiveByTeam.get('raaga')),
    agni:   zero(effectiveByTeam.get('agni')),
    tarang: zero(effectiveByTeam.get('tarang')),
    utsav:  zero(effectiveByTeam.get('utsav')),
  };

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
  const maxPoints = Math.max(...ALL_TEAMS.map(t => acc[t.id].totalPoints));

  // Build entries for all four teams
  const entries: TeamLeaderboardEntry[] = ALL_TEAMS.map(team => {
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
    lastUpdated: new Date().toISOString(),
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
