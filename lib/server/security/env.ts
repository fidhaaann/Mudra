export function requireEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getGoogleEnvVars() {
  return {
    email: requireEnvVar('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
    // Private keys in env vars might have escaped newlines
    privateKey: requireEnvVar('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n'),
    spreadsheetId: requireEnvVar('GOOGLE_SPREADSHEET_ID'),
    competitionSpreadsheetId: requireEnvVar('GOOGLE_COMPETITION_SPREADSHEET_ID'),
  };
}
