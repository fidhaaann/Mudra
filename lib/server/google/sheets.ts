import { google } from 'googleapis';
import { getGoogleEnvVars } from '../security/env';

// ─── auth ─────────────────────────────────────────────────────────────────────

function getSheetsClient() {
  const { email, privateKey } = getGoogleEnvVars();
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

// ─── types ────────────────────────────────────────────────────────────────────

export interface StudentRecord {
  studentId: string;
  name: string;
  semester: string;
  branch: string;
  team: string;
}

// ─── in-memory cache ──────────────────────────────────────────────────────────
// Student data changes only between events; 30 s is sufficient to absorb
// burst traffic without re-authenticating on every lookup request.

const CACHE_TTL_MS = 30_000; // 30 s

interface CacheEntry {
  data: StudentRecord[];
  expiresAt: number;
}

let studentsCache: CacheEntry | null = null;

// ─── fetch ────────────────────────────────────────────────────────────────────

/**
 * Fetches all student records from the "STUDENTS" sheet with a module-level
 * in-memory cache.  Multiple requests within the TTL window share the same
 * resolved data without triggering additional Sheets API calls.
 *
 * Assumes headers: STUDENT_ID | NAME | SEMESTER | BRANCH | TEAM
 */
export async function fetchAllStudents(): Promise<StudentRecord[]> {
  const now = Date.now();
  if (studentsCache && studentsCache.expiresAt > now) {
    return studentsCache.data;
  }

  const { spreadsheetId } = getGoogleEnvVars();
  const sheets = getSheetsClient();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'STUDENTS!A:E',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      studentsCache = { data: [], expiresAt: now + CACHE_TTL_MS };
      return [];
    }

    // Skip header row (row 0), map remaining rows to typed objects.
    // Guard every column access so malformed/short rows don't throw.
    const records: StudentRecord[] = rows.slice(1).map((row) => ({
      studentId: String(row[0] ?? '').trim(),
      name:      String(row[1] ?? '').trim(),
      semester:  String(row[2] ?? '').trim(),
      branch:    String(row[3] ?? '').trim(),
      team:      String(row[4] ?? '').trim(),
    }));

    studentsCache = { data: records, expiresAt: now + CACHE_TTL_MS };
    return records;
  } catch (error) {
    console.error('Error fetching student records from Google Sheets:', error);
    // Do not expose internal error details to the caller
    throw new Error('Failed to retrieve student records from database.');
  }
}
