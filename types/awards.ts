import type { DataStatus } from './leaderboard';

/**
 * Individual championship award winners, read from the AWARDS tab.
 * A null name means the cell is blank (winner not announced yet) or the
 * tab is missing/malformed.
 */
export interface AwardWinners {
  kalathilakam: string | null;
  kalaprathibha: string | null;
}

export interface AwardsResponse extends AwardWinners {
  /** When the AWARDS tab was read (ISO) — not the response time. */
  lastUpdated: string;
  /**
   * 'live' when every source was read from Google Sheets within its cache
   * window; 'stale' when a fallback copy is being shown because Sheets is
   * unavailable or slow. Clients should say so instead of implying live data.
   */
  dataStatus: DataStatus;
}
