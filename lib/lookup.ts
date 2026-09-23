import { StudentLookupQuery, StudentLookupResult } from "@/types/lookup";

/**
 * Service abstraction for querying student team assignment.
 * Connects to future backend/database populated via XLSX imports.
 */
export async function lookupStudentTeam(query: StudentLookupQuery): Promise<StudentLookupResult> {
  const cleanName = query.name.trim();

  if (!cleanName) {
    return { found: false, message: "Please enter your name." };
  }

  // Placeholder query delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Once backend/XLSX data is connected, this queries the database/API.
  return {
    found: false,
    message: "Student registration records are currently being finalized. Team assignments will be available shortly.",
  };
}
