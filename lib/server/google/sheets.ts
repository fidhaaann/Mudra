import { getGoogleEnvVars } from '../security/env';
import { cachedLoad, describeError } from '../cache';
import { getSheetsClient } from './client';

// ─── types ────────────────────────────────────────────────────────────────────

export interface StudentRecord {
  studentId: string;
  name: string;
  semester: string;
  branch: string;
  team: string;
}

// ─── caching ──────────────────────────────────────────────────────────────────
// Student allocations change rarely, so the list is kept for 5 minutes and
// can be served for up to 6 hours if Google Sheets is unavailable. Lookups
// never trigger a Sheets request of their own (see ../cache).

const STUDENTS_CACHE = { ttlMs: 5 * 60_000, staleMs: 6 * 60 * 60_000 };

// ─── fetch ────────────────────────────────────────────────────────────────────

/**
 * Fetches all student records from the "STUDENTS" sheet with a module-level
 * in-memory cache.  Multiple requests within the TTL window share the same
 * resolved data without triggering additional Sheets API calls.
 *
 * Assumes headers: STUDENT_ID | NAME | SEMESTER | BRANCH | TEAM
 */
export function fetchAllStudents(): Promise<StudentRecord[]> {
  return cachedLoad('students', STUDENTS_CACHE, loadAllStudents);
}

async function loadAllStudents(): Promise<StudentRecord[]> {
  const { spreadsheetId } = getGoogleEnvVars();
  // Student data is only ever read: use the read-only scope.
  const sheets = getSheetsClient('readonly');

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'STUDENTS!A:E',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
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

    return records;
  } catch (error) {
    // Never log the raw error: it carries the auth header (and request URL).
    console.error('Error fetching student records from Google Sheets:', describeError(error));
    // Do not expose internal error details to the caller
    throw new Error('Failed to retrieve student records from database.');
  }
}
