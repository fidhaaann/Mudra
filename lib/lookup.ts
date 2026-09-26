import { StudentLookupQuery, StudentLookupResult } from "@/types/lookup";

/**
 * Service function for querying student team assignment from the backend API.
 */
export async function lookupStudentTeam(query: StudentLookupQuery): Promise<StudentLookupResult> {
  const cleanName = query.name.trim();
  const cleanSemester = query.semester.trim();
  const cleanBranch = query.branch.trim();

  if (!cleanName || !cleanSemester || !cleanBranch) {
    return { 
      found: false, 
      message: "Please enter your name, semester, and branch." 
    };
  }

  const params = new URLSearchParams({
    name: cleanName,
    semester: cleanSemester,
    branch: cleanBranch,
  });

  try {
    const res = await fetch(`/api/team-lookup?${params.toString()}`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    const json = await res.json().catch(() => null);

    if (res.ok && json?.data) {
      return {
        found: true,
        student: json.data,
      };
    }

    if (res.status === 404) {
      return {
        found: false,
        message: json?.error || "No student record found matching the details provided.",
      };
    }

    if (res.status === 409) {
      return {
        found: false,
        message: json?.error || "Multiple records found matching these details. Please contact the coordinator.",
      };
    }

    if (res.status === 429) {
      return {
        found: false,
        message: "Too many search requests. Please wait a moment and try again.",
      };
    }

    if (res.status === 400) {
      return {
        found: false,
        message: json?.error || "Invalid details submitted. Please check the information entered.",
      };
    }

    return {
      found: false,
      message: json?.error || "Unable to look up team at this time. Please try again later.",
    };
  } catch {
    return {
      found: false,
      message: "Unable to connect to the server. Please check your internet connection.",
    };
  }
}
