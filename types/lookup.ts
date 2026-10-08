export interface StudentLookupQuery {
  name: string;
  semester: string;
  branch: string;
}

export interface StudentLookupData {
  name: string;
  semester: string;
  branch: string;
  team: string;
}

/** A possible match: name, semester and branch only (no team). */
export interface StudentLookupCandidate {
  name: string;
  semester: string;
  branch: string;
}

export interface StudentLookupResult {
  found: boolean;
  student?: StudentLookupData;
  message?: string;
  /** Present when the name was ambiguous; the user picks one to see the team. */
  matches?: StudentLookupCandidate[];
  /** True when more plausible names exist than were returned. */
  moreMatches?: boolean;
}
