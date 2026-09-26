export interface TeamLookupRequest {
  name: string;
  semester: string;
  branch: string;
}

export function validateLookupRequest(params: URLSearchParams): { data?: TeamLookupRequest, error?: string } {
  const name = params.get('name');
  const semester = params.get('semester');
  const branch = params.get('branch');

  if (!name || !semester || !branch) {
    return { error: 'Missing required fields. Please provide name, semester, and branch.' };
  }

  const cleanName = name.trim();
  const cleanSemester = semester.trim();
  const cleanBranch = branch.trim();

  if (cleanName.length < 2 || cleanName.length > 100) {
    return { error: 'Invalid name length.' };
  }
  
  if (cleanSemester.length < 1 || cleanSemester.length > 20) {
    return { error: 'Invalid semester length.' };
  }

  if (cleanBranch.length < 2 || cleanBranch.length > 50) {
    return { error: 'Invalid branch length.' };
  }

  return {
    data: {
      name: cleanName,
      semester: cleanSemester,
      branch: cleanBranch,
    }
  };
}
