import { google, sheets_v4 } from 'googleapis';
import { getGoogleEnvVars } from '../security/env';

/**
 * Shared, memoized Google Sheets clients.
 *
 * - One client per scope per server instance, so the OAuth access token is
 *   reused across requests instead of being fetched again for every call.
 * - A bounded request policy replaces googleapis' default (no timeout and
 *   three retries on everything, including quota errors):
 *     * 6 s timeout per attempt;
 *     * at most ONE retry, only for GET reads, only on 5xx or a dropped
 *       connection, after ~0.5 s;
 *     * never retry 429 (quota) — retrying makes a quota problem worse; the
 *       cache layer serves the last good data instead;
 *     * writes (PUT) are never retried here; the CALCULATED sync is
 *       idempotent and simply runs again on a later request.
 */

const REQUEST_TIMEOUT_MS = 6_000;

const REQUEST_POLICY = {
  timeout: REQUEST_TIMEOUT_MS,
  retryConfig: {
    retry: 1,
    noResponseRetries: 1,
    retryDelay: 500,
    httpMethodsToRetry: ['GET'],
    statusCodesToRetry: [[500, 599]],
  },
};

type Scope = 'readwrite' | 'readonly';

const SCOPES: Record<Scope, string> = {
  readwrite: 'https://www.googleapis.com/auth/spreadsheets',
  readonly: 'https://www.googleapis.com/auth/spreadsheets.readonly',
};

const clients = new Map<Scope, sheets_v4.Sheets>();

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * Load-test hook: SHEETS_API_MOCK_ROOT routes Sheets calls to the local mock
 * server (scripts/loadtest/mock-sheets.mjs). It is honoured ONLY when
 *  - the deployment is not Vercel Production (VERCEL_ENV !== 'production'), and
 *  - the URL points at this machine (http://127.0.0.1 / localhost / [::1]).
 * Anything else is ignored with an error log, so a stray variable can never
 * make the live site serve mock or third-party data.
 */
export function resolveMockRoot(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env.SHEETS_API_MOCK_ROOT?.trim();
  if (!raw) return null;
  if (env.VERCEL_ENV === 'production') {
    console.error('SHEETS_API_MOCK_ROOT is set in Production; ignoring it and using Google Sheets.');
    return null;
  }
  try {
    const url = new URL(raw);
    if (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname)) return url.toString();
  } catch {
    // fall through
  }
  console.error('SHEETS_API_MOCK_ROOT must be a loopback http URL; ignoring it.');
  return null;
}

function createClient(scope: Scope): sheets_v4.Sheets {
  // No credentials are ever sent to the mock.
  const mockRoot = resolveMockRoot();
  if (mockRoot) {
    return google.sheets({ version: 'v4', rootUrl: mockRoot, ...REQUEST_POLICY });
  }

  const { email, privateKey } = getGoogleEnvVars();
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: privateKey },
    scopes: [SCOPES[scope]],
  });
  return google.sheets({ version: 'v4', auth, ...REQUEST_POLICY });
}

/** Sheets client for the competition spreadsheet (reads + CALCULATED writes). */
export function getSheetsClient(scope: Scope = 'readwrite'): sheets_v4.Sheets {
  let client = clients.get(scope);
  if (!client) {
    client = createClient(scope);
    clients.set(scope, client);
  }
  return client;
}
