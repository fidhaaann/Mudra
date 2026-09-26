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

export interface StudentLookupResult {
  found: boolean;
  student?: StudentLookupData;
  message?: string;
}
