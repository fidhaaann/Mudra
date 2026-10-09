/**
 * Team Lookup form choices, shared by the form (app/team/page.tsx) and the
 * server-side validator, so the API accepts exactly what the form can send.
 */
export const SEMESTERS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"] as const;
export const DEPARTMENTS = ["CE", "CSE", "EC", "EEE", "EL", "SFE", "IT", "ME", "RA"] as const;
