import { fetchAllStudents } from '../google/sheets';
import { TeamLookupRequest } from '../validation/lookup';

export interface TeamLookupResult {
  name: string;
  semester: string;
  branch: string;
  team: string;
}

export type TeamLookupResponse = 
  | { type: 'success'; data: TeamLookupResult }
  | { type: 'not_found'; message: string }
  | { type: 'multiple_matches'; message: string }
  | { type: 'error'; message: string };

export async function findStudentTeam(request: TeamLookupRequest): Promise<TeamLookupResponse> {
  try {
    const students = await fetchAllStudents();
    
    // Normalize string for case-insensitive and whitespace-insensitive matching
    const normalize = (str: string) => str.trim().toLowerCase();
    
    const searchName = normalize(request.name);
    const searchSemester = normalize(request.semester);
    const searchBranch = normalize(request.branch);

    const matches = students.filter(student => 
      normalize(student.name) === searchName &&
      normalize(student.semester) === searchSemester &&
      normalize(student.branch) === searchBranch
    );

    if (matches.length === 0) {
      return { type: 'not_found', message: 'No student found matching these details.' };
    }

    if (matches.length > 1) {
      return { 
        type: 'multiple_matches', 
        message: 'Multiple records found matching these details. Please contact the administrator.' 
      };
    }

    const match = matches[0];
    return {
      type: 'success',
      data: {
        name: match.name,
        semester: match.semester,
        branch: match.branch,
        team: match.team,
      }
    };
  } catch (error) {
    // Log internal error but return a generic message
    console.error('Service error in findStudentTeam:', error);
    return { type: 'error', message: 'Internal server error while searching for team.' };
  }
}
