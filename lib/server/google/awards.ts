import { getSheetsClient } from './competition';
import { getGoogleEnvVars } from '../security/env';
import { AwardWinners } from '@/types/awards';

// ─── in-memory cache ──────────────────────────────────────────────────────────
// Same 30 s TTL as the other competition sheet readers.

const CACHE_TTL_MS = 30_000; // 30 s

interface CacheEntry {
  data: AwardWinners;
  expiresAt: number;
}

let awardsCache: CacheEntry | null = null;

// Fixed layout: headers in row 1, manually entered winner names in row 2.
const AWARDS_RANGE = 'AWARDS!A1:B2';
const EXPECTED_HEADERS = ['kalathilakam', 'kalaprathibha'] as const;

const EMPTY_AWARDS: AwardWinners = { kalathilakam: null, kalaprathibha: null };

/** Lowercase and drop spaces/punctuation so "Kala Thilakam" still matches. */
function normalizeHeader(value: unknown): string {
  return String(value ?? '').toLowerCase().replace(/[^a-z]/g, '');
}

/** Trimmed name, or null for blank/non-text cells. */
function parseName(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const name = String(value).trim();
  return name || null;
}

/**
 * Reads the two award winner names from AWARDS!A2:B2, validating the
 * KALATHILAKAM / KALAPRATHIBHA headers in A1:B1. Blank cells resolve to null;
 * a missing or malformed header row yields both names as null.
 */
export async function fetchAwards(): Promise<AwardWinners> {
  const now = Date.now();
  if (awardsCache && awardsCache.expiresAt > now) return awardsCache.data;

  const { competitionSpreadsheetId } = getGoogleEnvVars();
  const sheets = getSheetsClient();

  let rows: unknown[][];
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: competitionSpreadsheetId,
      range: AWARDS_RANGE,
    });
    rows = Array.isArray(response.data.values) ? (response.data.values as unknown[][]) : [];
  } catch (error) {
    console.error('Error fetching awards from Google Sheets:', error);
    // Do not expose internal error details to the caller
    throw new Error('Failed to retrieve award data.');
  }

  const headers = Array.isArray(rows[0]) ? rows[0] : [];
  const values = Array.isArray(rows[1]) ? rows[1] : [];

  const headersValid = EXPECTED_HEADERS.every(
    (expected, i) => normalizeHeader(headers[i]) === expected
  );

  let data: AwardWinners;
  if (!headersValid) {
    console.warn('AWARDS sheet headers are missing or malformed; expected KALATHILAKAM | KALAPRATHIBHA in A1:B1.');
    data = EMPTY_AWARDS;
  } else {
    data = {
      kalathilakam: parseName(values[0]),
      kalaprathibha: parseName(values[1]),
    };
  }

  awardsCache = { data, expiresAt: now + CACHE_TTL_MS };
  return data;
}
