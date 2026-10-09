import { DEPARTMENTS, SEMESTERS } from '@/lib/lookup-options';

export interface TeamLookupRequest {
  name: string;
  semester: string;
  branch: string;
}

/**
 * Characters never valid in a name, semester or branch: control/format
 * characters (incl. zero-width and bidi overrides) and markup/script
 * punctuation. Letters in any script (e.g. Malayalam), digits, spaces and
 * ordinary punctuation such as . ' - ( ) & / remain allowed. The zero-width
 * joiner / non-joiner (U+200D / U+200C) are format characters but are part
 * of normal Malayalam spelling, so they stay allowed.
 */
const FORBIDDEN = /[\p{Cc}<>{}[\]\\`$;|^~*=]|(?![‌‍])\p{Cf}/u;

/** Parameters the endpoint accepts; anything else is rejected. */
const ALLOWED_PARAMS = new Set(['name', 'semester', 'branch']);

const clean = (value: string) => value.normalize('NFC').replace(/\s+/g, ' ').trim();

export function validateLookupRequest(params: URLSearchParams): { data?: TeamLookupRequest, error?: string } {
  for (const key of params.keys()) {
    if (!ALLOWED_PARAMS.has(key)) {
      return { error: 'Unexpected parameter.' };
    }
  }
  // One value per field: repeated parameters are ambiguous.
  if (['name', 'semester', 'branch'].some((key) => params.getAll(key).length > 1)) {
    return { error: 'Each field may only be provided once.' };
  }

  const name = params.get('name');
  const semester = params.get('semester');
  const branch = params.get('branch');

  if (!name || !semester || !branch) {
    return { error: 'Missing required fields. Please provide name, semester, and branch.' };
  }

  // Length limits are checked on the raw input first, so oversized values
  // are rejected before any normalisation work.
  if (name.length > 200 || semester.length > 40 || branch.length > 100) {
    return { error: 'Input is too long.' };
  }

  const cleanName = clean(name);
  const cleanSemester = clean(semester);
  const cleanBranch = clean(branch);

  if ([cleanName, cleanSemester, cleanBranch].some((value) => FORBIDDEN.test(value))) {
    return { error: 'Input contains characters that are not allowed.' };
  }

  if (cleanName.length < 2 || cleanName.length > 100) {
    return { error: 'Invalid name length.' };
  }

  // Semester and branch are fixed choices in the form; accept only those.
  const semesterChoice = SEMESTERS.find((s) => s === cleanSemester.toUpperCase());
  if (!semesterChoice) {
    return { error: 'Invalid semester.' };
  }

  const branchChoice = DEPARTMENTS.find((d) => d === cleanBranch.toUpperCase());
  if (!branchChoice) {
    return { error: 'Invalid branch.' };
  }

  return {
    data: {
      name: cleanName,
      semester: semesterChoice,
      branch: branchChoice,
    }
  };
}
