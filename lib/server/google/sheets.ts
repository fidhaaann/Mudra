import { google } from 'googleapis';
import { getGoogleEnvVars } from '../security/env';

/**
 * Initializes and returns the Google Sheets API client using service account credentials.
 */
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

export interface StudentRecord {
  studentId: string;
  name: string;
  semester: string;
  branch: string;
  team: string;
}

/**
 * Fetches all student records from the "STUDENTS" sheet.
 * Assumes headers: STUDENT_ID | NAME | SEMESTER | BRANCH | TEAM
 */
export async function fetchAllStudents(): Promise<StudentRecord[]> {
  const { spreadsheetId } = getGoogleEnvVars();
  const sheets = getSheetsClient();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'STUDENTS!A:E', // Ensure this matches your columns
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    // Skip header row, map to objects
    return rows.slice(1).map(row => ({
      studentId: row[0] || '',
      name: row[1] || '',
      semester: row[2] || '',
      branch: row[3] || '',
      team: row[4] || '',
    }));
  } catch (error) {
    console.error('Error fetching Google Sheets data:', error);
    // Don't expose internal errors to the caller
    throw new Error('Failed to retrieve student records from database.');
  }
}
