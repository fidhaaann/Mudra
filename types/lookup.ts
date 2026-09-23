import { TeamId } from "./team";

export interface StudentLookupQuery {
  name: string;
  semester: string; // e.g. "1" - "8"
  year: string;     // e.g. "1" - "4"
}

export interface StudentRecord {
  id: string;
  name: string;
  normalizedName: string;
  semester: string;
  year: string;
  teamId: TeamId;
  teamName: string;
}

export interface StudentLookupResult {
  found: boolean;
  student?: {
    name: string;
    semester: string;
    year: string;
    teamId: TeamId;
    teamName: string;
  };
  message?: string;
}
