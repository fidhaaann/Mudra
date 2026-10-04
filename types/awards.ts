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
  lastUpdated: string; // ISO timestamp
}
