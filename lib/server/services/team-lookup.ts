import { fetchAllStudents, StudentRecord } from '../google/sheets';
import { TeamLookupRequest } from '../validation/lookup';
import { matchByName, normalizeName, MIN_FUZZY_QUERY_LENGTH } from './name-match';

export interface TeamLookupResult {
  name: string;
  semester: string;
  branch: string;
  team: string;
}

/**
 * A "did you mean" suggestion. Deliberately limited to name, semester and
 * branch — the team is only revealed once the user picks a specific student.
 */
export interface TeamLookupCandidate {
  name: string;
  semester: string;
  branch: string;
}

export type TeamLookupResponse =
  | { type: 'success'; data: TeamLookupResult }
  | { type: 'candidates'; matches: TeamLookupCandidate[]; more: boolean }
  | { type: 'not_found'; message: string }
  | { type: 'query_too_short'; message: string }
  | { type: 'multiple_matches'; message: string }
  | { type: 'error'; message: string };

export async function findStudentTeam(request: TeamLookupRequest): Promise<TeamLookupResponse> {
  try {
    // Served from the in-memory sheet cache — no Sheets request per search.
    const students = await fetchAllStudents();

    // Normalize string for case-insensitive and whitespace-insensitive matching
    const normalize = (str: string) => str.trim().toLowerCase();

    const searchName = normalize(request.name);
    const searchSemester = normalize(request.semester);
    const searchBranch = normalize(request.branch);

    // Only students in the selected semester + branch are ever considered.
    const cohort = students.filter(student =>
      normalize(student.semester) === searchSemester &&
      normalize(student.branch) === searchBranch
    );

    // Rows with the same registered name (duplicate sheet entries) form one
    // group, so a student is never listed twice as a possible match.
    const groups = new Map<string, StudentRecord[]>();
    for (const student of cohort) {
      const key = normalize(student.name);
      const group = groups.get(key);
      if (group) group.push(student);
      else groups.set(key, [student]);
    }

    // 1. Exact registered name (original behaviour) always wins.
    const exact = groups.get(searchName);
    if (exact) {
      return resolveGroup(exact);
    }

    // 2. Fuzzy name match within the cohort.
    const outcome = matchByName(request.name, [...groups.values()], group => group[0].name);

    if (outcome.kind === 'direct') {
      return resolveGroup(outcome.item);
    }

    if (outcome.kind === 'candidates') {
      return {
        type: 'candidates',
        matches: outcome.items.map(([student]) => ({
          name: student.name,
          semester: student.semester,
          branch: student.branch,
        })),
        more: outcome.more,
      };
    }

    if (normalizeName(request.name).compact.length < MIN_FUZZY_QUERY_LENGTH) {
      return {
        type: 'query_too_short',
        message: `Please enter at least ${MIN_FUZZY_QUERY_LENGTH} letters of your name.`,
      };
    }

    return { type: 'not_found', message: 'No matching student found.' };
  } catch (error) {
    // Log internal error but return a generic message
    console.error('Service error in findStudentTeam:', error);
    return { type: 'error', message: 'Internal server error while searching for team.' };
  }
}

/**
 * One registered name → its result. Duplicate rows that agree on the team are
 * unambiguous; rows that disagree keep the original "contact admin" response.
 */
function resolveGroup(group: StudentRecord[]): TeamLookupResponse {
  const teams = new Set(group.map(student => student.team.trim().toLowerCase()));
  if (teams.size > 1) {
    return {
      type: 'multiple_matches',
      message: 'Multiple records found matching these details. Please contact the administrator.'
    };
  }
  return { type: 'success', data: toResult(group[0]) };
}

function toResult(student: TeamLookupResult): TeamLookupResult {
  return {
    name: student.name,
    semester: student.semester,
    branch: student.branch,
    team: student.team,
  };
}
